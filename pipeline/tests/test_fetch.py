from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx
import pytest

from pipeline import db
from pipeline.fetch import (
    DomainRateLimiter,
    RobotsCache,
    fetch_source,
    select_due_sources,
)
from pipeline.tests.conftest import fetch_source_row, make_http_client, snapshots_for

PAGE_V1 = b"<html><body>ISA charge 0.25%</body></html>"
PAGE_V2 = b"<html><body>ISA charge 0.40%</body></html>"


def run_fetch(client, store, http_client, source_id="src-isa"):
    """One fetch of one source, with waiting stubbed out so tests stay fast."""
    limiter = DomainRateLimiter(sleep=lambda _s: None)
    return fetch_source(
        fetch_source_row(client, source_id),
        client=client,
        store=store,
        http_client=http_client,
        robots=RobotsCache(http_client),
        limiter=limiter,
    )


class TestSuccessfulCapture:
    def test_records_a_snapshot_with_hashes_body_and_key(self, client, store, seeded):
        outcome = run_fetch(client, store, make_http_client(body=PAGE_V1))

        assert outcome.status == "captured"
        assert outcome.is_change is True

        rows = snapshots_for(client, "src-isa")
        assert len(rows) == 1
        row = rows[0]
        assert row["http_status"] == 200
        assert row["fetch_error"] is None
        assert row["byte_size"] == len(PAGE_V1)
        assert row["is_change"] == 1
        # the stored object holds exactly the bytes that came back
        assert store.get(row["storage_key"]) == PAGE_V1
        assert row["storage_key"].startswith("snapshots/acme-invest/src-isa/")

    def test_raw_and_content_hashes_are_recorded_separately(self, client, store, seeded):
        # Normalisation means the two hashes differ for the same bytes; both
        # are kept, because raw is the evidence and content drives detection.
        run_fetch(client, store, make_http_client(body=PAGE_V1))
        row = snapshots_for(client, "src-isa")[0]
        assert len(row["raw_sha256"]) == 64
        assert len(row["content_sha256"]) == 64
        assert row["raw_sha256"] != row["content_sha256"]

    def test_updates_the_source_check_and_change_timestamps(self, client, store, seeded):
        run_fetch(client, store, make_http_client(body=PAGE_V1))
        source = fetch_source_row(client, "src-isa")
        assert source["last_checked_at"] is not None
        assert source["last_changed_at"] is not None
        assert source["consecutive_failures"] == 0


class TestUnchangedRefetch:
    def test_still_writes_a_row_but_does_not_mark_a_change(self, client, store, seeded):
        # "We checked on this date and nothing had changed" is evidence in its
        # own right, so the second fetch must leave a record too.
        run_fetch(client, store, make_http_client(body=PAGE_V1))
        outcome = run_fetch(client, store, make_http_client(body=PAGE_V1))

        assert outcome.status == "unchanged"
        assert outcome.is_change is False

        rows = snapshots_for(client, "src-isa")
        assert len(rows) == 2
        assert [r["is_change"] for r in rows] == [1, 0]

    def test_leaves_last_changed_at_alone(self, client, store, seeded):
        run_fetch(client, store, make_http_client(body=PAGE_V1))
        first_changed_at = fetch_source_row(client, "src-isa")["last_changed_at"]

        run_fetch(client, store, make_http_client(body=PAGE_V1))
        assert fetch_source_row(client, "src-isa")["last_changed_at"] == first_changed_at

    def test_whitespace_only_differences_are_not_a_change(self, client, store, seeded):
        # The floor of what normalisation must absorb: reindented markup is
        # not a repricing.
        run_fetch(client, store, make_http_client(body=b"<p>ISA   charge 0.25%</p>"))
        outcome = run_fetch(client, store, make_http_client(body=b"<p>ISA charge\n0.25%</p>"))
        assert outcome.is_change is False


class TestChangedContent:
    def test_marks_a_change_when_the_page_differs(self, client, store, seeded):
        run_fetch(client, store, make_http_client(body=PAGE_V1))
        outcome = run_fetch(client, store, make_http_client(body=PAGE_V2))

        assert outcome.status == "captured"
        assert outcome.is_change is True
        assert [r["is_change"] for r in snapshots_for(client, "src-isa")] == [1, 1]

    def test_both_versions_remain_retrievable(self, client, store, seeded):
        # The whole point of the archive: the old capture is never overwritten.
        run_fetch(client, store, make_http_client(body=PAGE_V1))
        run_fetch(client, store, make_http_client(body=PAGE_V2))
        rows = snapshots_for(client, "src-isa")
        assert store.get(rows[0]["storage_key"]) == PAGE_V1
        assert store.get(rows[1]["storage_key"]) == PAGE_V2


class TestRobots:
    def test_disallowed_url_is_skipped_without_a_snapshot(self, client, store, seeded):
        http_client = make_http_client(robots_body="User-agent: *\nDisallow: /isa/\n")
        outcome = run_fetch(client, store, http_client)

        assert outcome.status == "skipped_robots"
        assert snapshots_for(client, "src-isa") == []

    def test_a_disallowed_skip_does_not_count_as_a_failure(self, client, store, seeded):
        # Being told not to crawl is not the source being broken.
        http_client = make_http_client(robots_body="User-agent: *\nDisallow: /\n")
        run_fetch(client, store, http_client)
        assert fetch_source_row(client, "src-isa")["consecutive_failures"] == 0

    def test_missing_robots_txt_permits_fetching(self, client, store, seeded):
        http_client = make_http_client(robots_status=404, robots_body="")
        assert run_fetch(client, store, http_client).status == "captured"

    def test_unreachable_robots_txt_does_not_assume_consent(self, client, store, seeded):
        # Permission could not be established, so the page is not fetched.
        requested: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            requested.append(request.url.path)
            if request.url.path == "/robots.txt":
                return httpx.Response(503)
            return httpx.Response(200, content=PAGE_V1)

        run_fetch(client, store, make_http_client(handler=handler))
        assert "/isa/charges" not in requested

    def test_unreachable_robots_txt_is_recorded_as_a_failure(self, client, store, seeded):
        # It must escalate rather than sit in a silent "skipped" state — a
        # provider whose whole domain has gone down looks exactly like this.
        outcome = run_fetch(client, store, make_http_client(robots_status=503, robots_body=""))

        assert outcome.status == "failed"
        rows = snapshots_for(client, "src-isa")
        assert len(rows) == 1
        assert "robots.txt unavailable" in rows[0]["fetch_error"]
        assert rows[0]["is_change"] == 0
        assert fetch_source_row(client, "src-isa")["consecutive_failures"] == 1

    def test_an_unreachable_host_escalates_after_repeated_attempts(self, client, store, seeded):
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("no route to host")

        for _ in range(3):
            run_fetch(client, store, make_http_client(handler=handler))
        assert fetch_source_row(client, "src-isa")["consecutive_failures"] == 3


class TestFailures:
    def test_network_error_still_records_a_snapshot(self, client, store, seeded):
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                return httpx.Response(200, text="User-agent: *\nAllow: /\n")
            raise httpx.ConnectError("connection refused")

        outcome = run_fetch(client, store, make_http_client(handler=handler))

        assert outcome.status == "failed"
        rows = snapshots_for(client, "src-isa")
        assert len(rows) == 1
        assert "ConnectError" in rows[0]["fetch_error"]
        assert rows[0]["is_change"] == 0
        # nothing was retrieved, so nothing was stored
        assert rows[0]["storage_key"] == ""

    def test_error_status_stores_the_body_as_evidence(self, client, store, seeded):
        body = b"<html>403 Forbidden</html>"
        outcome = run_fetch(client, store, make_http_client(body=body, status=403))

        assert outcome.status == "failed"
        row = snapshots_for(client, "src-isa")[0]
        assert row["http_status"] == 403
        assert row["fetch_error"] == "HTTP 403"
        assert store.get(row["storage_key"]) == body

    def test_a_failure_never_looks_like_a_repricing(self, client, store, seeded):
        # An outage must not propagate downstream as a pricing change.
        run_fetch(client, store, make_http_client(body=PAGE_V1))
        run_fetch(client, store, make_http_client(body=b"error", status=500))

        rows = snapshots_for(client, "src-isa")
        assert rows[1]["is_change"] == 0

    def test_a_failure_does_not_become_the_baseline_for_the_next_comparison(
        self, client, store, seeded
    ):
        # After an error page, re-serving the ORIGINAL content must read as
        # unchanged — the failed capture is not a version of the page.
        run_fetch(client, store, make_http_client(body=PAGE_V1))
        run_fetch(client, store, make_http_client(body=b"error", status=500))
        outcome = run_fetch(client, store, make_http_client(body=PAGE_V1))

        assert outcome.status == "unchanged"

    def test_consecutive_failures_accumulate_then_reset_on_success(self, client, store, seeded):
        for _ in range(3):
            run_fetch(client, store, make_http_client(body=b"", status=500))
        assert fetch_source_row(client, "src-isa")["consecutive_failures"] == 3

        run_fetch(client, store, make_http_client(body=PAGE_V1))
        assert fetch_source_row(client, "src-isa")["consecutive_failures"] == 0


class TestRateLimiting:
    def test_waits_between_requests_to_the_same_host(self):
        slept: list[float] = []
        clock = iter([0.0, 0.0, 1.0, 5.0])
        limiter = DomainRateLimiter(
            min_interval=5.0,
            sleep=slept.append,
            clock=lambda: next(clock),
        )
        limiter.wait_for("https://acme.example/a")
        limiter.wait_for("https://acme.example/b")

        assert slept == [4.0]

    def test_does_not_wait_between_different_hosts(self):
        slept: list[float] = []
        limiter = DomainRateLimiter(min_interval=5.0, sleep=slept.append, clock=lambda: 0.0)
        limiter.wait_for("https://acme.example/a")
        limiter.wait_for("https://other.example/a")

        assert slept == []


class TestSelectDueSources:
    def _set_last_checked(self, client, source_id: str, when: datetime) -> None:
        db.execute(
            client,
            "update sources set last_checked_at = ? where id = ?",
            [when.strftime("%Y-%m-%dT%H:%M:%SZ"), source_id],
        )

    def test_a_never_checked_source_is_due(self, client, seeded):
        assert [r["id"] for r in select_due_sources(client)] == ["src-isa"]

    def test_a_recently_checked_source_is_not_due(self, client, seeded):
        now = datetime.now(timezone.utc)
        self._set_last_checked(client, "src-isa", now - timedelta(hours=1))
        assert select_due_sources(client, now=now) == []

    def test_becomes_due_once_its_interval_has_elapsed(self, client, seeded):
        now = datetime.now(timezone.utc)
        self._set_last_checked(client, "src-isa", now - timedelta(days=8))
        assert [r["id"] for r in select_due_sources(client, now=now)] == ["src-isa"]

    def test_frequency_filter_excludes_other_schedules(self, client, seeded):
        assert select_due_sources(client, frequency="daily") == []
        assert len(select_due_sources(client, frequency="weekly")) == 1

    def test_explicit_source_id_ignores_the_schedule(self, client, seeded):
        now = datetime.now(timezone.utc)
        self._set_last_checked(client, "src-isa", now)
        assert len(select_due_sources(client, source_id="src-isa", now=now)) == 1

    def test_inactive_sources_are_never_selected_even_by_id(self, client, seeded):
        db.execute(client, "update sources set is_active = 0 where id = ?", ["src-isa"])
        assert select_due_sources(client) == []
        assert select_due_sources(client, source_id="src-isa") == []

    def test_an_unparseable_timestamp_does_not_freeze_a_source_out(self, client, seeded):
        # A bad value should mean "check it", never "never check it again".
        db.execute(
            client, "update sources set last_checked_at = ? where id = ?", ["nonsense", "src-isa"]
        )
        assert len(select_due_sources(client)) == 1
