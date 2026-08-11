"""
Stage 2 — change detection, replayed over stored snapshots.

The live fetcher already normalises and compares as it captures, so this is
not what decides `is_change` day to day. This is the tool for the other case:
**re-deciding it after the normalisation rules change.**

That case is not exotic, it is the expected workflow. Tuning normalisation
against real captured pages is how the review queue is kept usable, and every
edit to `normalise.py` invalidates every hash computed under the old rules.
Without a replay path the only options would be to accept one spurious change
on every source, or to never touch the rules again.

Because the raw bytes were kept, neither is necessary: normalisation can be
re-run over the entire history and the derived columns rebuilt.

## On rewriting rows in an append-only table

`snapshots` is append-only, and this module updates two of its columns. The
distinction that makes that legitimate:

- **Evidence** — `observed_at`, `raw_sha256`, `storage_key`, `http_status`,
  and the stored bytes themselves. These record what happened. They are never
  touched, here or anywhere.
- **Derived classification** — `content_sha256` and `is_change`. These are
  this pipeline's *interpretation* of the evidence under a particular set of
  rules, and the brief is explicit that derived views get regenerated as the
  rules improve.

Rewriting an interpretation is not rewriting history. Rewriting evidence would
be, and nothing here does it.

Run it:

    python -m pipeline.detect                      # report over everything, change nothing
    python -m pipeline.detect --source-id <id>     # one source
    python -m pipeline.detect --write              # persist the recomputed values
"""

from __future__ import annotations

import argparse
import logging
import sys
from contextlib import closing
from dataclasses import dataclass
from typing import Any, Sequence

from pipeline import db
from pipeline.normalise import content_hash
from pipeline.storage import ObjectStore, resolve_object_store

log = logging.getLogger("pipeline.detect")


@dataclass
class RedetectResult:
    snapshot_id: str
    source_id: str
    observed_at: str
    old_content_sha256: str
    new_content_sha256: str
    old_is_change: bool
    new_is_change: bool

    @property
    def differs(self) -> bool:
        return (
            self.old_content_sha256 != self.new_content_sha256
            or self.old_is_change != self.new_is_change
        )


def list_source_ids(client: Any, source_id: str | None = None) -> list[str]:
    if source_id:
        return [source_id]
    return [r["id"] for r in db.query(client, "select id from sources order by id")]


def redetect_source(client: Any, store: ObjectStore, source_id: str) -> list[RedetectResult]:
    """
    Recomputes the normalised hash and change flag for one source's whole
    history, in capture order.

    Only successful captures participate. A failed attempt has no content to
    normalise, and — just as in the live fetcher — must never become the
    baseline that the next real capture is compared against, or an outage
    would manufacture a change the moment the site came back.
    """
    selector_rows = db.query(
        client, "select content_selector from sources where id = ?", [source_id]
    )
    if not selector_rows:
        log.warning("no such source: %s", source_id)
        return []
    content_selector = selector_rows[0]["content_selector"]

    snapshots = db.query(
        client,
        """
        select id, observed_at, storage_key, content_sha256, is_change
        from snapshots
        where source_id = ? and fetch_error is null and storage_key != ''
        order by observed_at asc, rowid asc
        """,
        [source_id],
    )

    results: list[RedetectResult] = []
    previous_hash: str | None = None

    for snapshot in snapshots:
        try:
            raw = store.get(snapshot["storage_key"])
        except (OSError, KeyError) as exc:
            # A missing object is a real problem worth surfacing, but it must
            # not abort the replay for every later snapshot in the history.
            log.error(
                "cannot read stored object %s for snapshot %s: %s",
                snapshot["storage_key"],
                snapshot["id"],
                exc,
            )
            continue

        new_hash = content_hash(raw, content_selector=content_selector)
        new_is_change = previous_hash is None or previous_hash != new_hash

        results.append(
            RedetectResult(
                snapshot_id=snapshot["id"],
                source_id=source_id,
                observed_at=snapshot["observed_at"],
                old_content_sha256=snapshot["content_sha256"],
                new_content_sha256=new_hash,
                old_is_change=bool(snapshot["is_change"]),
                new_is_change=new_is_change,
            )
        )
        previous_hash = new_hash

    return results


def apply_results(client: Any, results: Sequence[RedetectResult]) -> int:
    written = 0
    for result in results:
        if not result.differs:
            continue
        db.execute(
            client,
            "update snapshots set content_sha256 = ?, is_change = ? where id = ?",
            [result.new_content_sha256, 1 if result.new_is_change else 0, result.snapshot_id],
        )
        written += 1
    return written


def run(
    *,
    client: Any,
    store: ObjectStore,
    source_id: str | None = None,
    write: bool = False,
) -> list[RedetectResult]:
    all_results: list[RedetectResult] = []
    for sid in list_source_ids(client, source_id):
        all_results.extend(redetect_source(client, store, sid))

    differing = [r for r in all_results if r.differs]
    log.info(
        "%s snapshot(s) replayed, %s would change under the current rules",
        len(all_results),
        len(differing),
    )
    for result in differing:
        log.info(
            "  %s %s  is_change %s -> %s  sha %s -> %s",
            result.source_id,
            result.observed_at,
            int(result.old_is_change),
            int(result.new_is_change),
            result.old_content_sha256[:10],
            result.new_content_sha256[:10],
        )

    if write:
        written = apply_results(client, all_results)
        log.info("wrote %s row(s)", written)
    elif differing:
        log.info("dry run — nothing written. Re-run with --write to persist.")

    return all_results


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Replay normalisation over stored snapshots and recompute change flags."
    )
    parser.add_argument("--source-id", help="replay one source instead of all of them")
    parser.add_argument(
        "--write",
        action="store_true",
        help="persist the recomputed values (default is a dry-run report)",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="[detect] %(levelname)s %(message)s")

    with closing(db.connect()) as client:
        run(
            client=client,
            store=resolve_object_store(),
            source_id=args.source_id,
            write=args.write,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
