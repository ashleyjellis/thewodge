"""
Seed data.

Two things matter here. The rows must actually satisfy the schema — every
CHECK constraint and foreign key — because a seed that half-applies leaves the
archive in a state nobody planned. And re-running must be safe, because this
file will be re-run every time a provider or source is added to it, long after
the earlier rows have been edited by hand in the admin UI.
"""

from __future__ import annotations

from pipeline import db
from pipeline.seed import INITIAL_SOURCES, PROVIDER_WEBSITES, PROVIDERS, run, seed_providers


class TestProviders:
    def test_all_providers_insert_cleanly(self, client):
        added = seed_providers(client)
        assert added == len(PROVIDERS)
        assert db.query(client, "select count(*) n from providers")[0]["n"] == len(PROVIDERS)

    def test_provider_ids_are_unique(self):
        ids = [p[0] for p in PROVIDERS]
        assert len(ids) == len(set(ids))

    def test_every_provider_type_satisfies_the_check_constraint(self, client):
        # The DB is the arbiter, not a copy of the enum kept in the test.
        seed_providers(client)
        rows = db.query(client, "select distinct provider_type from providers")
        assert len(rows) > 1

    def test_websites_are_only_set_for_providers_we_collect_from(self, client):
        # A guessed URL looks authoritative while being unverified, so absent
        # is the honest default until a provider's pages are confirmed.
        run(client=client)
        with_site = db.query(client, "select id from providers where website is not null")
        assert {r["id"] for r in with_site} == set(PROVIDER_WEBSITES)

    def test_every_website_belongs_to_a_real_provider(self):
        provider_ids = {p[0] for p in PROVIDERS}
        assert set(PROVIDER_WEBSITES).issubset(provider_ids)


class TestSources:
    def test_all_sources_insert_cleanly(self, client):
        _, added = run(client=client)
        assert added == len(INITIAL_SOURCES)

    def test_source_ids_are_unique(self):
        ids = [s[0] for s in INITIAL_SOURCES]
        assert len(ids) == len(set(ids))

    def test_urls_are_unique(self):
        urls = [s[2] for s in INITIAL_SOURCES]
        assert len(urls) == len(set(urls))

    def test_every_source_points_at_a_seeded_provider(self):
        # A foreign key violation here would abort a partially-applied seed.
        provider_ids = {p[0] for p in PROVIDERS}
        for source in INITIAL_SOURCES:
            assert source[1] in provider_ids, f"{source[0]} references unknown provider {source[1]}"

    def test_every_url_is_https(self):
        for source in INITIAL_SOURCES:
            assert source[2].startswith("https://"), source[0]

    def test_pdf_sources_are_typed_as_pdf(self):
        # Mistyping a PDF as html would send it through the HTML normaliser,
        # which would produce a meaningless hash off binary content.
        for source in INITIAL_SOURCES:
            if source[2].lower().endswith(".pdf"):
                assert source[3] == "pdf", f"{source[0]} is a PDF but typed {source[3]}"

    def test_the_authoritative_rate_card_is_marked_as_such(self, client):
        run(client=client)
        rows = db.query(client, "select id from sources where is_authoritative = 1")
        assert [r["id"] for r in rows] == ["ajbell-sipp-charges-pdf"]

    def test_sources_start_on_a_gentle_cadence(self):
        # Nothing should be introduced to a new site at daily frequency.
        assert {s[6] for s in INITIAL_SOURCES} == {"weekly"}

    def test_the_starting_set_stays_small(self):
        # Guards against this list quietly growing into a broad crawl without
        # the deliberate decision that widening coverage is meant to require.
        providers_covered = {s[1] for s in INITIAL_SOURCES}
        assert len(providers_covered) <= 5


class TestIdempotency:
    def test_running_twice_adds_nothing_the_second_time(self, client):
        run(client=client)
        providers_added, sources_added = run(client=client)
        assert (providers_added, sources_added) == (0, 0)

    def test_running_twice_does_not_duplicate_rows(self, client):
        run(client=client)
        run(client=client)
        assert db.query(client, "select count(*) n from providers")[0]["n"] == len(PROVIDERS)
        assert db.query(client, "select count(*) n from sources")[0]["n"] == len(INITIAL_SOURCES)

    def test_a_reseed_never_reverts_an_edit_made_in_the_admin_ui(self, client):
        # The important one. A corrected URL, a tuned content_selector or a
        # deactivation must survive the next time a provider is appended to
        # this file and the seed is re-run.
        run(client=client)
        db.execute(
            client,
            """
            update sources
            set url = ?, content_selector = ?, is_active = 0, check_frequency = 'daily'
            where id = ?
            """,
            ["https://www.hl.co.uk/moved", "#charges-table", "hl-isa-charges"],
        )

        run(client=client)

        row = db.query(client, "select * from sources where id = ?", ["hl-isa-charges"])[0]
        assert row["url"] == "https://www.hl.co.uk/moved"
        assert row["content_selector"] == "#charges-table"
        assert row["is_active"] == 0
        assert row["check_frequency"] == "daily"

    def test_providers_only_mode_adds_no_collection_targets(self, client):
        # Listing a company is inert; pointing a crawler at it is not.
        run(client=client, with_sources=False)
        assert db.query(client, "select count(*) n from sources")[0]["n"] == 0
        assert db.query(client, "select count(*) n from providers")[0]["n"] == len(PROVIDERS)


class TestSeededDataIsUsableByTheFetcher:
    def test_seeded_sources_are_selected_as_due(self, client):
        # Nothing has ever been checked, so everything should be due — proves
        # the seeded shape actually satisfies the fetcher's own query.
        from pipeline.fetch import select_due_sources

        run(client=client)
        due = select_due_sources(client)
        assert len(due) == len(INITIAL_SOURCES)

    def test_a_seeded_source_carries_the_fields_a_fetch_needs(self, client):
        from pipeline.fetch import select_due_sources

        run(client=client)
        source = select_due_sources(client, source_id="hl-isa-charges")[0]
        assert source["provider_id"] == "hargreaves-lansdown"
        assert source["fetch_method"] == "http"
        assert source["url"].startswith("https://")
        assert source["source_type"] == "html"
