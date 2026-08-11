from __future__ import annotations

import pytest

from pipeline.storage import (
    LocalFileObjectStore,
    R2ObjectStore,
    build_storage_key,
    resolve_object_store,
)

R2_VARS = (
    "ARCHIVE_R2_BUCKET",
    "ARCHIVE_R2_ENDPOINT_URL",
    "ARCHIVE_R2_ACCESS_KEY_ID",
    "ARCHIVE_R2_SECRET_ACCESS_KEY",
)


class TestBuildStorageKey:
    def test_partitions_by_provider_source_and_capture_date(self):
        key = build_storage_key(
            provider_id="acme-invest",
            source_id="src-isa",
            snapshot_id="snap-1",
            source_type="html",
            observed_at="2026-08-11T09:30:50Z",
        )
        assert key == "snapshots/acme-invest/src-isa/2026/08/11/snap-1.html"

    def test_uses_the_pdf_extension_for_pdf_sources(self):
        key = build_storage_key(
            provider_id="acme-invest",
            source_id="src-card",
            snapshot_id="snap-2",
            source_type="pdf",
            observed_at="2026-01-02T00:00:00Z",
        )
        assert key.endswith("/snap-2.pdf")

    def test_takes_the_date_from_observed_at_not_from_today(self):
        # The key and the snapshot row must never disagree about which day a
        # capture belongs to, including for a replayed or backdated capture.
        key = build_storage_key(
            provider_id="p",
            source_id="s",
            snapshot_id="snap",
            source_type="html",
            observed_at="1999-12-31T23:59:59Z",
        )
        assert "/1999/12/31/" in key

    def test_falls_back_to_a_generic_extension_for_unknown_types(self):
        key = build_storage_key(
            provider_id="p",
            source_id="s",
            snapshot_id="snap",
            source_type="something-else",
            observed_at="2026-08-11T09:30:50Z",
        )
        assert key.endswith(".bin")


class TestLocalFileObjectStore:
    def test_round_trips_bytes_exactly(self, tmp_path):
        store = LocalFileObjectStore(tmp_path)
        payload = b"\x00\x01binary\xff not text"
        store.put("snapshots/a/b/2026/08/11/x.html", payload)
        assert store.get("snapshots/a/b/2026/08/11/x.html") == payload

    def test_creates_nested_directories(self, tmp_path):
        store = LocalFileObjectStore(tmp_path)
        store.put("deeply/nested/path/object.pdf", b"pdf")
        assert (tmp_path / "deeply" / "nested" / "path" / "object.pdf").is_file()

    def test_exists_reports_presence(self, tmp_path):
        store = LocalFileObjectStore(tmp_path)
        assert store.exists("nope.html") is False
        store.put("yes.html", b"x")
        assert store.exists("yes.html") is True


class TestResolveObjectStore:
    def test_uses_local_storage_when_no_r2_configured(self, monkeypatch):
        for var in R2_VARS:
            monkeypatch.delenv(var, raising=False)
        assert isinstance(resolve_object_store(), LocalFileObjectStore)

    def test_rejects_partial_r2_configuration(self, monkeypatch):
        # Half-configured R2 would silently write production captures to a
        # CI runner's disk, which is then discarded — fail loudly instead.
        for var in R2_VARS:
            monkeypatch.delenv(var, raising=False)
        monkeypatch.setenv("ARCHIVE_R2_BUCKET", "archive")
        monkeypatch.setenv("ARCHIVE_R2_ACCESS_KEY_ID", "key")

        with pytest.raises(RuntimeError, match="Partial R2 configuration"):
            resolve_object_store()

    def test_builds_an_r2_store_when_fully_configured(self, monkeypatch):
        for var in R2_VARS:
            monkeypatch.setenv(var, "value")
        monkeypatch.setenv("ARCHIVE_R2_ENDPOINT_URL", "https://r2.example")

        created = {}

        class FakeBoto:
            @staticmethod
            def client(service, **kwargs):
                created["service"] = service
                created.update(kwargs)
                return object()

        monkeypatch.setitem(__import__("sys").modules, "boto3", FakeBoto)

        store = resolve_object_store()
        assert isinstance(store, R2ObjectStore)
        assert created["service"] == "s3"
        assert created["endpoint_url"] == "https://r2.example"
