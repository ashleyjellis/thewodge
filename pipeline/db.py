"""
Archive database access for the pipeline.

Deliberately mirrors src/server/archiveDb/client.ts: the same environment
variables, the same local-file fallback, the same escape hatch. One database,
two languages, one set of credentials — so a developer who can run the admin
UI locally can also run the pipeline locally, with no extra setup and no
network.

Thin by design. The pipeline writes a small, fixed set of rows and the SQL is
short enough to read at the call site; there is no ORM here and no
schema definition — src/server/archiveDb/schema.ts is the single source of
truth for the schema, and drizzle/archive/*.sql is what actually creates it
(including in this module's own tests, which apply those same files).
"""

from __future__ import annotations

import os
from typing import Any, Sequence

import libsql_client

DEFAULT_LOCAL_DB_PATH = ".data/wodge-archive.db"


def resolve_db_url() -> tuple[str, str | None]:
    """
    Returns (url, auth_token) for the archive database.

    Real Turso when ARCHIVE_TURSO_DATABASE_URL is set, otherwise a local
    libSQL file. ARCHIVE_FORCE_LOCAL_DB=1 forces the local file even when
    Turso credentials are present — useful when working somewhere that
    cannot reach Turso without having to move .env aside.
    """
    force_local = os.environ.get("ARCHIVE_FORCE_LOCAL_DB") == "1"
    url = None if force_local else os.environ.get("ARCHIVE_TURSO_DATABASE_URL")
    if url:
        return url, os.environ.get("ARCHIVE_TURSO_AUTH_TOKEN")

    path = os.environ.get("ARCHIVE_LOCAL_DB_PATH") or DEFAULT_LOCAL_DB_PATH
    return f"file:{path}", None


def connect(url: str | None = None, auth_token: str | None = None) -> libsql_client.ClientSync:
    """
    Opens a synchronous client. Callers are responsible for closing it —
    every entrypoint in this package uses a `with closing(...)` block.
    """
    if url is None:
        url, auth_token = resolve_db_url()
    return libsql_client.create_client_sync(url, auth_token=auth_token)


def query(
    client: libsql_client.ClientSync, sql: str, args: Sequence[Any] | None = None
) -> list[libsql_client.Row]:
    """Runs a statement and returns its rows. Rows support both index and name access."""
    return list(client.execute(sql, list(args) if args else []).rows)


def execute(
    client: libsql_client.ClientSync, sql: str, args: Sequence[Any] | None = None
) -> None:
    """Runs a statement for its effect."""
    client.execute(sql, list(args) if args else [])
