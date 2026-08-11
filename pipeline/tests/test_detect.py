"""
The replay detector.

Its whole reason to exist is the moment after normalisation rules change, so
the tests centre on that: stale hashes computed under old rules must be
rebuilt correctly, and the rebuild must never touch the evidence.
"""

from __future__ import annotations

from pipeline import db
from pipeline.detect import redetect_source, run
from pipeline.normalise import content_hash
from pipeline.tests.conftest import snapshots_for

PAGE_V1 = b"<html><body><p>Platform fee 0.25%</p></body></html>"
PAGE_V2 = b"<html><body><p>Platform fee 0.45%</p></body></html>"


def add_snapshot(
    client,
    store,
    *,
    snapshot_id: str,
    observed_at: str,
    body: bytes,
    content_sha256: str = "stale-hash-from-old-rules",
    is_change: int = 0,
    fetch_error: str | None = None,
    storage_key: str | None = None,
):
    """Writes a snapshot row and its stored object directly, bypassing the fetcher."""
    if storage_key is None:
        storage_key = f"snapshots/acme-invest/src-isa/2026/08/11/{snapshot_id}.html"
    if storage_key:
        store.put(storage_key, body)
    db.execute(
        client,
        """
        insert into snapshots (
            id, source_id, observed_at, http_status, content_sha256, raw_sha256,
            storage_key, byte_size, content_type, is_change, fetch_error
        ) values (?, 'src-isa', ?, 200, ?, 'raw', ?, ?, 'text/html', ?, ?)
        """,
        [
            snapshot_id,
            observed_at,
            content_sha256,
            storage_key,
            len(body),
            is_change,
            fetch_error,
        ],
    )


class TestReplay:
    def test_recomputes_hashes_under_the_current_rules(self, client, store, seeded):
        add_snapshot(client, store, snapshot_id="s1", observed_at="2026-01-01T00:00:00Z", body=PAGE_V1)

        results = redetect_source(client, store, "src-isa")

        assert len(results) == 1
        assert results[0].new_content_sha256 == content_hash(PAGE_V1)
        assert results[0].differs is True

    def test_rebuilds_the_change_sequence_across_a_history(self, client, store, seeded):
        add_snapshot(client, store, snapshot_id="s1", observed_at="2026-01-01T00:00:00Z", body=PAGE_V1)
        add_snapshot(client, store, snapshot_id="s2", observed_at="2026-01-02T00:00:00Z", body=PAGE_V1)
        add_snapshot(client, store, snapshot_id="s3", observed_at="2026-01-03T00:00:00Z", body=PAGE_V2)

        results = redetect_source(client, store, "src-isa")

        # first sighting, unchanged, then a real repricing
        assert [r.new_is_change for r in results] == [True, False, True]

    def test_dry_run_writes_nothing(self, client, store, seeded):
        add_snapshot(client, store, snapshot_id="s1", observed_at="2026-01-01T00:00:00Z", body=PAGE_V1)

        run(client=client, store=store, write=False)

        assert snapshots_for(client, "src-isa")[0]["content_sha256"] == "stale-hash-from-old-rules"

    def test_write_persists_the_recomputed_values(self, client, store, seeded):
        add_snapshot(client, store, snapshot_id="s1", observed_at="2026-01-01T00:00:00Z", body=PAGE_V1)
        add_snapshot(client, store, snapshot_id="s2", observed_at="2026-01-02T00:00:00Z", body=PAGE_V2)

        run(client=client, store=store, write=True)

        rows = snapshots_for(client, "src-isa")
        assert rows[0]["content_sha256"] == content_hash(PAGE_V1)
        assert rows[1]["content_sha256"] == content_hash(PAGE_V2)
        assert [r["is_change"] for r in rows] == [1, 1]

    def test_corrects_a_false_positive_left_by_old_rules(self, client, store, seeded):
        # The exact scenario this tool exists for: two captures that differ
        # only in noise were flagged as a change under the old rules.
        noisy_a = b'<html><body><span class="last-updated">1 Jan</span><p>Fee 0.25%</p></body></html>'
        noisy_b = b'<html><body><span class="last-updated">2 Jan</span><p>Fee 0.25%</p></body></html>'
        add_snapshot(
            client, store, snapshot_id="s1", observed_at="2026-01-01T00:00:00Z",
            body=noisy_a, content_sha256="old-a", is_change=1,
        )
        add_snapshot(
            client, store, snapshot_id="s2", observed_at="2026-01-02T00:00:00Z",
            body=noisy_b, content_sha256="old-b", is_change=1,
        )

        run(client=client, store=store, write=True)

        rows = snapshots_for(client, "src-isa")
        assert [r["is_change"] for r in rows] == [1, 0]

    def test_applies_the_sources_content_selector(self, client, store, seeded):
        db.execute(
            client, "update sources set content_selector = ? where id = ?", ["#charges", "src-isa"]
        )
        a = b'<html><body><nav>Home</nav><div id="charges">Fee 0.25%</div></body></html>'
        b = b'<html><body><nav>Home About Careers</nav><div id="charges">Fee 0.25%</div></body></html>'
        add_snapshot(client, store, snapshot_id="s1", observed_at="2026-01-01T00:00:00Z", body=a)
        add_snapshot(client, store, snapshot_id="s2", observed_at="2026-01-02T00:00:00Z", body=b)

        results = redetect_source(client, store, "src-isa")

        assert [r.new_is_change for r in results] == [True, False]


class TestEvidenceIsNeverTouched:
    def test_leaves_raw_hash_key_and_timestamp_alone(self, client, store, seeded):
        add_snapshot(client, store, snapshot_id="s1", observed_at="2026-01-01T00:00:00Z", body=PAGE_V1)
        before = snapshots_for(client, "src-isa")[0]

        run(client=client, store=store, write=True)

        after = snapshots_for(client, "src-isa")[0]
        assert after["raw_sha256"] == before["raw_sha256"]
        assert after["storage_key"] == before["storage_key"]
        assert after["observed_at"] == before["observed_at"]
        assert after["http_status"] == before["http_status"]

    def test_never_deletes_or_adds_rows(self, client, store, seeded):
        add_snapshot(client, store, snapshot_id="s1", observed_at="2026-01-01T00:00:00Z", body=PAGE_V1)
        add_snapshot(client, store, snapshot_id="s2", observed_at="2026-01-02T00:00:00Z", body=PAGE_V2)

        run(client=client, store=store, write=True)

        assert len(snapshots_for(client, "src-isa")) == 2

    def test_the_stored_bytes_are_untouched(self, client, store, seeded):
        add_snapshot(client, store, snapshot_id="s1", observed_at="2026-01-01T00:00:00Z", body=PAGE_V1)
        key = snapshots_for(client, "src-isa")[0]["storage_key"]

        run(client=client, store=store, write=True)

        assert store.get(key) == PAGE_V1


class TestFailedCaptures:
    def test_failed_rows_are_excluded_from_the_replay(self, client, store, seeded):
        add_snapshot(
            client, store, snapshot_id="s1", observed_at="2026-01-01T00:00:00Z",
            body=b"", storage_key="", fetch_error="ConnectError",
        )
        assert redetect_source(client, store, "src-isa") == []

    def test_a_failure_does_not_become_the_comparison_baseline(self, client, store, seeded):
        # Same invariant the live fetcher holds: an outage in the middle of a
        # history must not manufacture a change when the site comes back.
        add_snapshot(client, store, snapshot_id="s1", observed_at="2026-01-01T00:00:00Z", body=PAGE_V1)
        add_snapshot(
            client, store, snapshot_id="s2", observed_at="2026-01-02T00:00:00Z",
            body=b"", storage_key="", fetch_error="HTTP 500",
        )
        add_snapshot(client, store, snapshot_id="s3", observed_at="2026-01-03T00:00:00Z", body=PAGE_V1)

        results = redetect_source(client, store, "src-isa")

        assert [r.snapshot_id for r in results] == ["s1", "s3"]
        assert [r.new_is_change for r in results] == [True, False]

    def test_an_error_page_with_a_body_is_still_excluded(self, client, store, seeded):
        # The dangerous variant: a 403 or 500 page that DID return HTML gets
        # its body stored as evidence. If such a row were replayed as a real
        # capture, the error page's text would become the baseline and the
        # site's recovery would read as two consecutive repricings.
        add_snapshot(client, store, snapshot_id="s1", observed_at="2026-01-01T00:00:00Z", body=PAGE_V1)
        add_snapshot(
            client, store, snapshot_id="s2", observed_at="2026-01-02T00:00:00Z",
            body=b"<html><body><h1>403 Forbidden</h1></body></html>", fetch_error="HTTP 403",
        )
        add_snapshot(client, store, snapshot_id="s3", observed_at="2026-01-03T00:00:00Z", body=PAGE_V1)

        results = redetect_source(client, store, "src-isa")

        assert [r.snapshot_id for r in results] == ["s1", "s3"]
        assert [r.new_is_change for r in results] == [True, False]


class TestResilience:
    def test_a_missing_stored_object_does_not_abort_the_rest(self, client, store, seeded):
        add_snapshot(client, store, snapshot_id="s1", observed_at="2026-01-01T00:00:00Z", body=PAGE_V1)
        add_snapshot(client, store, snapshot_id="s2", observed_at="2026-01-02T00:00:00Z", body=PAGE_V2)
        # simulate an object that cannot be read back
        db.execute(
            client, "update snapshots set storage_key = ? where id = ?", ["snapshots/gone.html", "s1"]
        )

        results = redetect_source(client, store, "src-isa")

        assert [r.snapshot_id for r in results] == ["s2"]

    def test_an_unknown_source_id_is_reported_not_raised(self, client, store, seeded):
        assert redetect_source(client, store, "no-such-source") == []
