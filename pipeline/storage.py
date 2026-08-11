"""
Object storage for raw snapshot bytes.

The raw capture is the asset. Everything downstream — normalisation,
extraction, the structured `charges` rows — is a derived view that will be
regenerated many times as the schema and prompts improve. So these bytes are
written once and never modified or deleted, and every derived stage is built
to be replayable against them.

Two implementations behind one protocol, selected by whether R2 credentials
are present — the same "works locally with no credentials" pattern the
database client uses. Tests and local development use the filesystem; nothing
about the calling code changes.

The database stores only the key and the hashes, never the bytes (libSQL is
not a blob store, and snapshots can reach megabytes each).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Protocol

from pipeline.config import EXTENSION_BY_SOURCE_TYPE, LOCAL_OBJECT_STORE_PATH


def build_storage_key(
    *,
    provider_id: str,
    source_id: str,
    snapshot_id: str,
    source_type: str,
    observed_at: str,
) -> str:
    """
    snapshots/{provider_id}/{source_id}/{YYYY}/{MM}/{DD}/{snapshot_id}.{ext}

    Date-partitioned so a given day's captures can be listed or lifecycled
    without touching the database, and keyed by snapshot id so every fetch
    attempt gets its own immutable object — including two fetches of
    identical content. That deliberately stores duplicate bytes when nothing
    changed: one row and one object per fetch is what makes "we checked on
    this date and it had not changed" provable, which is itself part of the
    record.

    `observed_at` is an ISO-8601 UTC string (YYYY-MM-DDTHH:MM:SSZ); the date
    is sliced from it directly rather than re-deriving "now", so the key and
    the snapshot row can never disagree about which day a capture belongs to.
    """
    year, month, day = observed_at[0:4], observed_at[5:7], observed_at[8:10]
    ext = EXTENSION_BY_SOURCE_TYPE.get(source_type, "bin")
    return f"snapshots/{provider_id}/{source_id}/{year}/{month}/{day}/{snapshot_id}.{ext}"


class ObjectStore(Protocol):
    """Write-once storage. There is deliberately no delete()."""

    def put(self, key: str, data: bytes, *, content_type: str | None = None) -> None: ...

    def get(self, key: str) -> bytes: ...

    def exists(self, key: str) -> bool: ...


class LocalFileObjectStore:
    """
    Filesystem-backed store for dev and tests. Writes under .data/ (already
    gitignored), creating parent directories as needed.
    """

    def __init__(self, root: str | Path = LOCAL_OBJECT_STORE_PATH) -> None:
        self.root = Path(root)

    def _path(self, key: str) -> Path:
        return self.root / key

    def put(self, key: str, data: bytes, *, content_type: str | None = None) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def get(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()


class R2ObjectStore:
    """
    Cloudflare R2 via its S3-compatible API. boto3 is imported lazily so the
    dependency is only needed where R2 is actually used — tests and local
    runs never touch it.
    """

    def __init__(
        self,
        *,
        bucket: str,
        endpoint_url: str,
        access_key_id: str,
        secret_access_key: str,
    ) -> None:
        import boto3  # noqa: PLC0415 — lazy on purpose, see class docstring

        self.bucket = bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            # R2 ignores region but boto3 requires one to be set
            region_name="auto",
        )

    def put(self, key: str, data: bytes, *, content_type: str | None = None) -> None:
        extra = {"ContentType": content_type} if content_type else {}
        self._client.put_object(Bucket=self.bucket, Key=key, Body=data, **extra)

    def get(self, key: str) -> bytes:
        response = self._client.get_object(Bucket=self.bucket, Key=key)
        return response["Body"].read()

    def exists(self, key: str) -> bool:
        from botocore.exceptions import ClientError  # noqa: PLC0415 — lazy, see above

        try:
            self._client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False


def resolve_object_store() -> ObjectStore:
    """
    R2 when fully configured, filesystem otherwise. All four R2 variables are
    required together — a partially-configured R2 is a misconfiguration worth
    failing loudly on rather than silently writing production captures to a
    local disk that a CI runner throws away minutes later.
    """
    bucket = os.environ.get("ARCHIVE_R2_BUCKET")
    endpoint = os.environ.get("ARCHIVE_R2_ENDPOINT_URL")
    key_id = os.environ.get("ARCHIVE_R2_ACCESS_KEY_ID")
    secret = os.environ.get("ARCHIVE_R2_SECRET_ACCESS_KEY")

    provided = [v for v in (bucket, endpoint, key_id, secret) if v]
    if not provided:
        return LocalFileObjectStore()
    if len(provided) < 4:
        raise RuntimeError(
            "Partial R2 configuration: ARCHIVE_R2_BUCKET, ARCHIVE_R2_ENDPOINT_URL, "
            "ARCHIVE_R2_ACCESS_KEY_ID and ARCHIVE_R2_SECRET_ACCESS_KEY must all be "
            "set together, or all be unset to use local file storage."
        )

    assert bucket and endpoint and key_id and secret  # narrowed by the check above
    return R2ObjectStore(
        bucket=bucket,
        endpoint_url=endpoint,
        access_key_id=key_id,
        secret_access_key=secret,
    )
