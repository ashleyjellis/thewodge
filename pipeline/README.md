# Provider pricing archive — pipeline

Captures and archives published pricing from UK D2C investment platforms, so
there is a verifiable record of what each provider charged and when.

Historical pricing cannot be acquired retroactively at any price. Six major UK
providers repriced in the twelve months to March 2026 and nobody holds a
checkable record of what changed or when. Every day of collection compounds;
every day not collected is gone.

**The raw capture is the asset.** Everything downstream — normalisation,
extraction, the structured `charges` rows — is a derived view that will be
regenerated many times as the schema and prompts improve. Raw captures are
never discarded, and every derived stage is built to be replayable against
them.

## Where this sits

| Piece | Lives in |
|---|---|
| Schema (source of truth) | `src/server/archiveDb/schema.ts` |
| Migrations | `drizzle/archive/*.sql` |
| TypeScript DB client (admin UI) | `src/server/archiveDb/client.ts` |
| Python DB client (this pipeline) | `pipeline/db.py` |

One database, two languages, one set of environment variables. Both clients
fall back to the same local libSQL file when no Turso URL is set, so the whole
thing runs locally with no credentials and no network.

## Setup

```bash
python3 -m venv pipeline/.venv
pipeline/.venv/bin/pip install -r pipeline/requirements.txt
pipeline/.venv/bin/playwright install chromium   # only if using playwright sources

pnpm archive:db:migrate          # creates/updates the archive database
pipeline/.venv/bin/python -m pytest pipeline/tests
```

## Running the fetcher

```bash
python -m pipeline.fetch                     # everything currently due
python -m pipeline.fetch --frequency daily   # only daily sources
python -m pipeline.fetch --source-id <id>    # one source, ignoring its schedule
```

## Stages

Each stage is independently re-runnable against stored artefacts. Extraction
must be replayable over historical snapshots without re-fetching.

| Stage | Module | Status |
|---|---|---|
| 1. Fetch | `fetch.py` | built |
| 2. Detect changes | `normalise.py` → `detect.py` | baseline only — see below |
| 3. Extract | `extract.py` | not built |
| 4. Review queue | admin UI | not built |

### Stage 1 — fetcher

Three properties it is built around:

- **A row per attempt, always.** Successes, unchanged pages and failures all
  insert a `snapshots` row. "We checked on this date and nothing had changed"
  is evidence; so is "we checked and the page was gone". A gap in the record
  cannot be reconstructed later.
- **Politeness is not optional.** An honest User-Agent naming the crawler and
  a contact URL, robots.txt respected rather than worked around, and a hard
  5-second floor between requests to the same domain. Nothing parallelises
  within a provider.
- **Failures never look like changes.** A 500 page or a network error records
  the failure and leaves `is_change` false, so an outage can never propagate
  downstream as a repricing.

robots.txt gets a three-way answer, because the cases need different
responses:

| Answer | Behaviour |
|---|---|
| allowed | fetch |
| disallowed | skip, log, **not** counted as a failure — the provider said no; nothing is broken |
| unavailable (5xx / unreachable) | skip, **and count as a failure** — otherwise a provider whose domain has gone down sits in a permanent "skipped" state that never escalates |

A source that keeps failing is surfaced after 3 consecutive failures. Fetching
still continues: that is a flag for a human, not a circuit breaker, because a
source that has genuinely moved needs someone to notice rather than the system
quietly giving up.

### Stage 2 — change detection (partially built)

`normalise.py` currently contains only the content-agnostic baseline: decode,
collapse whitespace, lowercase. The HTML-aware ruleset — stripping
script/style/comments, dropping nonce and CSRF attributes, removing
known-dynamic regions like cookie banners and "last updated" stamps, honouring
a source's `content_selector` — is the next phase's work, and it is where the
real effort goes: untuned normalisation produces daily false positives on
every source and makes the review queue unusable.

The fetcher already computes hashes and sets `is_change` by comparing against
the previous *successful* capture, so the loop works end to end today; that
next phase replaces the internals of `normalise.py` without touching
`fetch.py`.

**One operational consequence, worth knowing before it surprises someone:**
whenever the normalisation rules change, every source's normalised hash
changes with them, so the first run afterwards reports a change on everything
at once. It is self-correcting — the next run goes quiet — but normalisation
should not be edited casually mid-collection, and a rules change is a good
moment to re-run detection over stored snapshots rather than trusting the live
diff.

## Storage layout

```
snapshots/{provider_id}/{source_id}/{YYYY}/{MM}/{DD}/{snapshot_id}.{ext}
```

Cloudflare R2 in production, a local directory under `.data/` in development
and tests, selected by whether R2 credentials are present. A partially
configured R2 is rejected loudly rather than silently falling back to local
disk — otherwise production captures would be written to a CI runner that
throws them away minutes later.

Every fetch gets its own object, including two fetches of identical content.
That deliberately stores duplicate bytes: one row and one object per fetch is
what makes "we checked and it had not changed" provable, and the brief treats
storage cost as trivial next to the value of the record.

## Environment

All optional locally — with none of these set, the pipeline uses a local
database file and local object storage.

| Variable | Purpose |
|---|---|
| `ARCHIVE_TURSO_DATABASE_URL` / `ARCHIVE_TURSO_AUTH_TOKEN` | archive database |
| `ARCHIVE_LOCAL_DB_PATH` | local DB file (default `.data/wodge-archive.db`) |
| `ARCHIVE_FORCE_LOCAL_DB=1` | ignore Turso credentials even when present |
| `ARCHIVE_R2_BUCKET` / `_ENDPOINT_URL` / `_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` | object storage (all four together, or none) |

## Testing

Tests run against a real, freshly-migrated libSQL file and a real filesystem
object store — the database is not mocked. The schema comes from the same
`drizzle/archive/*.sql` files that build production, so a schema change that
would break the pipeline breaks the tests too rather than passing against a
hand-maintained copy that has quietly drifted. Only the network is mocked, via
httpx's own `MockTransport`.

```bash
pipeline/.venv/bin/python -m pytest pipeline/tests -q
```

## Scope

This system records what providers published. It does not calculate what any
individual would pay, does not rank providers, and does not recommend.
Keeping that boundary clean is what keeps it outside the regulatory perimeter.

Before adding any provider as a source, check that provider's terms. Before
publishing comparative data externally, get a view from an FS regulatory
solicitor. Neither is a step the code can do for you.
