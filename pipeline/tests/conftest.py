"""
Shared fixtures.

Every test runs against a real, freshly-migrated libSQL file and a real
filesystem object store — no database mocking. The schema comes from the same
drizzle/archive/*.sql files that build the production database, so a schema
change that would break the pipeline breaks these tests too rather than
passing against a hand-maintained copy that has quietly drifted.

The network is the only thing mocked, via httpx's own MockTransport.
"""

from __future__ import annotations

from pathlib import Path
from typing import Callable

import httpx
import libsql_client
import pytest

from pipeline import db
from pipeline.storage import LocalFileObjectStore

REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = REPO_ROOT / "drizzle" / "archive"


def apply_migrations(client: libsql_client.ClientSync) -> None:
    for sql_file in sorted(MIGRATIONS_DIR.glob("*.sql")):
        statements = sql_file.read_text().split("--> statement-breakpoint")
        for statement in statements:
            statement = statement.strip()
            if statement:
                client.execute(statement)


@pytest.fixture
def client(tmp_path: Path):
    conn = db.connect(f"file:{tmp_path / 'archive-test.db'}")
    apply_migrations(conn)
    yield conn
    conn.close()


@pytest.fixture
def store(tmp_path: Path) -> LocalFileObjectStore:
    return LocalFileObjectStore(tmp_path / "objects")


@pytest.fixture
def seeded(client) -> dict[str, str]:
    """One provider and one http source, the minimum a fetch needs."""
    client.execute(
        "insert into providers (id, name, provider_type) values (?, ?, ?)",
        ["acme-invest", "Acme Invest", "platform"],
    )
    client.execute(
        """
        insert into sources (id, provider_id, url, source_type, label, fetch_method, check_frequency)
        values (?, ?, ?, ?, ?, ?, ?)
        """,
        [
            "src-isa",
            "acme-invest",
            "https://acme.example/isa/charges",
            "html",
            "ISA charges",
            "http",
            "weekly",
        ],
    )
    return {"provider_id": "acme-invest", "source_id": "src-isa"}


def make_http_client(
    *,
    body: bytes = b"<html><body>ISA charge 0.25%</body></html>",
    status: int = 200,
    content_type: str = "text/html",
    robots_body: str = "User-agent: *\nAllow: /\n",
    robots_status: int = 200,
    handler: Callable[[httpx.Request], httpx.Response] | None = None,
) -> httpx.Client:
    """
    An httpx.Client whose transport never touches the network.

    Serves robots.txt separately from the page itself so tests can vary each
    independently. Pass `handler` to take over routing entirely.
    """

    def default_handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(robots_status, text=robots_body)
        return httpx.Response(status, content=body, headers={"content-type": content_type})

    transport = httpx.MockTransport(handler or default_handler)
    return httpx.Client(transport=transport)


def fetch_source_row(client, source_id: str):
    return db.query(
        client,
        """
        select s.*, p.id as provider_slug
        from sources s join providers p on p.id = s.provider_id
        where s.id = ?
        """,
        [source_id],
    )[0]


def snapshots_for(client, source_id: str):
    return db.query(
        client,
        "select * from snapshots where source_id = ? order by observed_at asc, rowid asc",
        [source_id],
    )
