"""
Stage 1 — the fetcher.

Visits each due source, stores exactly what came back, and records that the
visit happened. Its one job is to never lose a capture and never misrepresent
one.

Three properties this stage is built around:

1. **A row per attempt, always.** Successes, unchanged pages and outright
   failures all insert a `snapshots` row. "We checked on this date and nothing
   had changed" is evidence, and so is "we checked and the page was gone" —
   a gap in the record cannot be reconstructed later.
2. **Politeness is not optional.** An honest User-Agent, robots.txt respected
   rather than worked around, and a hard floor on request rate per domain.
   Nothing here parallelises within a provider.
3. **Failures never look like changes.** A 500 page or a network error records
   the failure and leaves `is_change` false, so an outage can never
   masquerade as a repricing downstream.

Run it:

    python -m pipeline.fetch                      # everything currently due
    python -m pipeline.fetch --frequency daily    # only daily sources
    python -m pipeline.fetch --source-id <id>     # one source, ignoring its schedule
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
import urllib.robotparser
import uuid
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Literal, Sequence
from urllib.parse import urlparse, urlunparse

import httpx

from pipeline import db
from pipeline.config import (
    FAILURE_ALERT_THRESHOLD,
    FREQUENCY_INTERVAL_HOURS,
    MIN_DOMAIN_INTERVAL_SECONDS,
    REQUEST_TIMEOUT_SECONDS,
    USER_AGENT,
)
from pipeline.normalise import content_hash, raw_hash
from pipeline.storage import ObjectStore, build_storage_key, resolve_object_store

log = logging.getLogger("pipeline.fetch")

FetchStatus = Literal["captured", "unchanged", "failed", "skipped_robots"]
RobotsDecision = Literal["allowed", "disallowed", "unavailable"]

# sha256 of zero bytes — used for the hash columns on a failure that produced
# no body at all, so the NOT NULL columns hold something well-defined rather
# than a fabricated value.
EMPTY_SHA256 = raw_hash(b"")


def now_iso() -> str:
    """
    ISO-8601 UTC to the second — the exact shape the schema's own column
    defaults produce, so rows written from here and rows written by SQLite
    sort together correctly.
    """
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass
class FetchOutcome:
    source_id: str
    status: FetchStatus
    snapshot_id: str | None = None
    is_change: bool = False
    http_status: int | None = None
    error: str | None = None


@dataclass
class FetchedContent:
    """What came back from the network, before any interpretation."""

    body: bytes
    http_status: int | None
    content_type: str | None


# ── politeness ────────────────────────────────────────────────────────────


class DomainRateLimiter:
    """
    Enforces a minimum gap between requests to the same host.

    Deliberately per-host and stateful for the life of a run: a run that
    touches ten sources on one provider's domain will take at least
    9 x MIN_DOMAIN_INTERVAL_SECONDS, and that is the intended behaviour.
    """

    def __init__(
        self,
        min_interval: float = MIN_DOMAIN_INTERVAL_SECONDS,
        *,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.min_interval = min_interval
        self._sleep = sleep
        self._clock = clock
        self._last_request_at: dict[str, float] = {}

    def wait_for(self, url: str) -> None:
        host = urlparse(url).netloc
        last = self._last_request_at.get(host)
        now = self._clock()
        if last is not None:
            elapsed = now - last
            if elapsed < self.min_interval:
                self._sleep(self.min_interval - elapsed)
        self._last_request_at[host] = self._clock()


class RobotsCache:
    """
    Fetches and caches robots.txt per origin for the life of a run.

    Reports three distinct answers, because they demand different responses
    and collapsing them would mislead whoever reads the logs:

    - `allowed`     — crawl it.
    - `disallowed`  — the provider has said no. Skip, never override, and do
                      not treat it as a malfunction; nothing is broken.
    - `unavailable` — we could not establish permission at all (5xx, or the
                      host is unreachable). Also skip, but this one IS a
                      failure: a provider whose domain has gone down would
                      otherwise sit in a permanent "skipped" state that never
                      escalates to anyone.

    A 4xx is treated as `allowed`: no rules published conventionally means no
    restrictions, which is the standard reading of RFC 9309.
    """

    def __init__(self, http_client: httpx.Client) -> None:
        self._http = http_client
        self._parsers: dict[str, urllib.robotparser.RobotFileParser | None] = {}

    def _robots_url(self, url: str) -> str:
        parts = urlparse(url)
        return urlunparse((parts.scheme, parts.netloc, "/robots.txt", "", "", ""))

    def _load(self, origin_key: str, robots_url: str) -> urllib.robotparser.RobotFileParser | None:
        parser = urllib.robotparser.RobotFileParser()
        try:
            response = self._http.get(robots_url)
        except httpx.HTTPError as exc:
            log.warning("robots.txt unreachable at %s (%s) — skipping this run", robots_url, exc)
            return None

        if response.status_code >= 500:
            log.warning(
                "robots.txt returned %s at %s — skipping this run",
                response.status_code,
                robots_url,
            )
            return None
        if response.status_code >= 400:
            # No rules published; everything is permitted.
            parser.parse([])
            return parser

        parser.parse(response.text.splitlines())
        return parser

    def check(self, url: str) -> RobotsDecision:
        parts = urlparse(url)
        origin_key = f"{parts.scheme}://{parts.netloc}"
        if origin_key not in self._parsers:
            self._parsers[origin_key] = self._load(origin_key, self._robots_url(url))

        parser = self._parsers[origin_key]
        if parser is None:
            return "unavailable"
        return "allowed" if parser.can_fetch(USER_AGENT, url) else "disallowed"


# ── fetching ──────────────────────────────────────────────────────────────


def fetch_over_http(http_client: httpx.Client, url: str) -> FetchedContent:
    response = http_client.get(url, follow_redirects=True)
    return FetchedContent(
        body=response.content,
        http_status=response.status_code,
        content_type=response.headers.get("content-type"),
    )


def fetch_with_playwright(url: str) -> FetchedContent:
    """
    For sources whose pricing only exists after JavaScript runs.

    Imported lazily: playwright is a heavy dependency and the vast majority
    of sources never need it, so neither tests nor http-only runs pay for it.
    """
    from playwright.sync_api import sync_playwright  # noqa: PLC0415 — lazy on purpose

    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page(user_agent=USER_AGENT)
            response = page.goto(url, timeout=REQUEST_TIMEOUT_SECONDS * 1000, wait_until="load")
            html = page.content()
            return FetchedContent(
                body=html.encode("utf-8"),
                http_status=response.status if response else None,
                content_type="text/html",
            )
        finally:
            browser.close()


# ── database reads and writes ─────────────────────────────────────────────


def select_due_sources(
    client: Any,
    *,
    source_id: str | None = None,
    frequency: str | None = None,
    now: datetime | None = None,
) -> list[Any]:
    """
    Which sources this run should visit.

    An explicit --source-id bypasses the schedule entirely (that is what it is
    for), but never bypasses `is_active` — a deactivated source stays
    deactivated. Otherwise a source is due when it has never been checked, or
    when its last check is older than its own frequency's interval.
    """
    now = now or datetime.now(timezone.utc)

    if source_id:
        return db.query(
            client,
            """
            select s.*, p.id as provider_slug
            from sources s
            join providers p on p.id = s.provider_id
            where s.id = ? and s.is_active = 1
            """,
            [source_id],
        )

    rows = db.query(
        client,
        """
        select s.*, p.id as provider_slug
        from sources s
        join providers p on p.id = s.provider_id
        where s.is_active = 1
        order by s.last_checked_at asc nulls first
        """,
    )

    due = []
    for row in rows:
        if frequency and row["check_frequency"] != frequency:
            continue
        last_checked = row["last_checked_at"]
        if not last_checked:
            due.append(row)
            continue
        interval = FREQUENCY_INTERVAL_HOURS.get(row["check_frequency"], 24 * 7)
        try:
            last_dt = datetime.strptime(last_checked, "%Y-%m-%dT%H:%M:%SZ").replace(
                tzinfo=timezone.utc
            )
        except ValueError:
            # An unparseable timestamp should not silently freeze a source out
            # of collection forever — treat it as due and let it be rewritten.
            due.append(row)
            continue
        if now - last_dt >= timedelta(hours=interval):
            due.append(row)
    return due


def previous_successful_snapshot(client: Any, source_id: str) -> Any | None:
    rows = db.query(
        client,
        """
        select content_sha256
        from snapshots
        where source_id = ? and fetch_error is null
        order by observed_at desc, rowid desc
        limit 1
        """,
        [source_id],
    )
    return rows[0] if rows else None


def insert_snapshot(
    client: Any,
    *,
    snapshot_id: str,
    source_id: str,
    observed_at: str,
    http_status: int | None,
    content_sha256: str,
    raw_sha256_value: str,
    storage_key: str,
    byte_size: int | None,
    content_type: str | None,
    is_change: bool,
    fetch_error: str | None,
) -> None:
    db.execute(
        client,
        """
        insert into snapshots (
            id, source_id, observed_at, http_status, content_sha256, raw_sha256,
            storage_key, byte_size, content_type, is_change, fetch_error
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            snapshot_id,
            source_id,
            observed_at,
            http_status,
            content_sha256,
            raw_sha256_value,
            storage_key,
            byte_size,
            content_type,
            1 if is_change else 0,
            fetch_error,
        ],
    )


def record_success(client: Any, source_id: str, *, checked_at: str, changed: bool) -> None:
    if changed:
        db.execute(
            client,
            """
            update sources
            set last_checked_at = ?, last_changed_at = ?, consecutive_failures = 0
            where id = ?
            """,
            [checked_at, checked_at, source_id],
        )
    else:
        db.execute(
            client,
            "update sources set last_checked_at = ?, consecutive_failures = 0 where id = ?",
            [checked_at, source_id],
        )


def record_failure(client: Any, source_id: str, *, checked_at: str) -> int:
    db.execute(
        client,
        """
        update sources
        set last_checked_at = ?, consecutive_failures = consecutive_failures + 1
        where id = ?
        """,
        [checked_at, source_id],
    )
    rows = db.query(client, "select consecutive_failures from sources where id = ?", [source_id])
    return int(rows[0]["consecutive_failures"]) if rows else 0


# ── the per-source flow ───────────────────────────────────────────────────


def record_failed_fetch(
    client: Any,
    *,
    source: Any,
    store: ObjectStore,
    snapshot_id: str,
    observed_at: str,
    body: bytes,
    http_status: int | None,
    content_type: str | None,
    error: str,
) -> FetchOutcome:
    """
    Writes the snapshot row for an attempt that did not produce usable
    content, and advances the source's failure count.

    `is_change` stays false so an outage can never propagate downstream as a
    repricing. Any body that did come back (a 403 page, a redirect notice) is
    still stored — it is evidence of what happened. With no body at all the
    storage key is left empty; those rows are exactly the ones where
    `fetch_error` is not null.
    """
    source_id = source["id"]
    storage_key = ""
    if body:
        storage_key = build_storage_key(
            provider_id=source["provider_id"],
            source_id=source_id,
            snapshot_id=snapshot_id,
            source_type=source["source_type"],
            observed_at=observed_at,
        )
        store.put(storage_key, body, content_type=content_type)

    insert_snapshot(
        client,
        snapshot_id=snapshot_id,
        source_id=source_id,
        observed_at=observed_at,
        http_status=http_status,
        content_sha256=raw_hash(body) if body else EMPTY_SHA256,
        raw_sha256_value=raw_hash(body) if body else EMPTY_SHA256,
        storage_key=storage_key,
        byte_size=len(body) if body else None,
        content_type=content_type,
        is_change=False,
        fetch_error=error,
    )
    failures = record_failure(client, source_id, checked_at=observed_at)
    if failures >= FAILURE_ALERT_THRESHOLD:
        log.error(
            "source %s has now failed %s consecutive times — needs attention",
            source_id,
            failures,
        )
    return FetchOutcome(
        source_id=source_id,
        status="failed",
        snapshot_id=snapshot_id,
        http_status=http_status,
        error=error,
    )


def fetch_source(
    source: Any,
    *,
    client: Any,
    store: ObjectStore,
    http_client: httpx.Client,
    robots: RobotsCache,
    limiter: DomainRateLimiter,
) -> FetchOutcome:
    source_id = source["id"]
    url = source["url"]

    decision = robots.check(url)
    if decision == "disallowed":
        # Logged, never overridden, and never counted as a malfunction — the
        # provider has simply said no. A source that stays disallowed should
        # be deactivated by a human rather than silently retried forever.
        log.warning("robots.txt disallows %s — skipping (source %s)", url, source_id)
        return FetchOutcome(source_id=source_id, status="skipped_robots")

    if decision == "unavailable":
        # We could not establish permission, so we still do not fetch — but
        # this is a failure rather than a skip, so a host that has gone down
        # escalates instead of sitting quietly in a "skipped" state.
        error = "robots.txt unavailable — could not establish crawl permission"
        log.warning("%s for %s (source %s)", error, url, source_id)
        return record_failed_fetch(
            client,
            source=source,
            store=store,
            snapshot_id=str(uuid.uuid4()),
            observed_at=now_iso(),
            body=b"",
            http_status=None,
            content_type=None,
            error=error,
        )

    limiter.wait_for(url)
    observed_at = now_iso()
    snapshot_id = str(uuid.uuid4())

    try:
        if source["fetch_method"] == "playwright":
            fetched = fetch_with_playwright(url)
        else:
            fetched = fetch_over_http(http_client, url)
        error: str | None = None
        if fetched.http_status is not None and fetched.http_status >= 400:
            error = f"HTTP {fetched.http_status}"
    except Exception as exc:  # noqa: BLE001 — any failure must still be recorded
        fetched = FetchedContent(body=b"", http_status=None, content_type=None)
        error = f"{type(exc).__name__}: {exc}"
        log.warning("fetch failed for %s (source %s): %s", url, source_id, error)

    if error:
        return record_failed_fetch(
            client,
            source=source,
            store=store,
            snapshot_id=snapshot_id,
            observed_at=observed_at,
            body=fetched.body,
            http_status=fetched.http_status,
            content_type=fetched.content_type,
            error=error,
        )

    content_sha = content_hash(fetched.body, content_selector=source["content_selector"])
    previous = previous_successful_snapshot(client, source_id)
    # No prior successful capture means this is the first sighting of the
    # page, which is a change in the only sense that matters downstream:
    # there is nothing extracted from it yet.
    is_change = previous is None or previous["content_sha256"] != content_sha

    storage_key = build_storage_key(
        provider_id=source["provider_id"],
        source_id=source_id,
        snapshot_id=snapshot_id,
        source_type=source["source_type"],
        observed_at=observed_at,
    )
    store.put(storage_key, fetched.body, content_type=fetched.content_type)

    insert_snapshot(
        client,
        snapshot_id=snapshot_id,
        source_id=source_id,
        observed_at=observed_at,
        http_status=fetched.http_status,
        content_sha256=content_sha,
        raw_sha256_value=raw_hash(fetched.body),
        storage_key=storage_key,
        byte_size=len(fetched.body),
        content_type=fetched.content_type,
        is_change=is_change,
        fetch_error=None,
    )
    record_success(client, source_id, checked_at=observed_at, changed=is_change)

    return FetchOutcome(
        source_id=source_id,
        status="captured" if is_change else "unchanged",
        snapshot_id=snapshot_id,
        is_change=is_change,
        http_status=fetched.http_status,
    )


def run(
    *,
    client: Any,
    store: ObjectStore,
    http_client: httpx.Client,
    source_id: str | None = None,
    frequency: str | None = None,
    limiter: DomainRateLimiter | None = None,
) -> list[FetchOutcome]:
    sources = select_due_sources(client, source_id=source_id, frequency=frequency)
    log.info("%s source(s) due", len(sources))

    robots = RobotsCache(http_client)
    limiter = limiter or DomainRateLimiter()

    outcomes: list[FetchOutcome] = []
    for source in sources:
        outcome = fetch_source(
            source,
            client=client,
            store=store,
            http_client=http_client,
            robots=robots,
            limiter=limiter,
        )
        log.info("%s -> %s", source["url"], outcome.status)
        outcomes.append(outcome)
    return outcomes


def build_http_client() -> httpx.Client:
    return httpx.Client(
        headers={"User-Agent": USER_AGENT},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Fetch due archive sources.")
    parser.add_argument("--source-id", help="fetch one source, ignoring its schedule")
    parser.add_argument(
        "--frequency",
        choices=sorted(FREQUENCY_INTERVAL_HOURS),
        help="only fetch sources on this schedule",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="[fetch] %(levelname)s %(message)s")

    with closing(db.connect()) as client, closing(build_http_client()) as http_client:
        outcomes = run(
            client=client,
            store=resolve_object_store(),
            http_client=http_client,
            source_id=args.source_id,
            frequency=args.frequency,
        )

    tally: dict[str, int] = {}
    for outcome in outcomes:
        tally[outcome.status] = tally.get(outcome.status, 0) + 1
    log.info("done: %s", tally or "nothing due")

    # A failed fetch is recorded, not fatal — the run still succeeded at its
    # job of recording what happened. Only surface a non-zero exit when
    # nothing at all could be attempted.
    return 0


if __name__ == "__main__":
    sys.exit(main())
