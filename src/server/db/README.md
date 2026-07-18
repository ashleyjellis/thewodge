# Database — logged-in experience (Phase 1)

Turso (libSQL) via Drizzle ORM, migration-based. This is the data layer only —
no UI, no routes, no auth. Calculation logic (a later phase) must import from
this module's typed query functions and never write raw SQL.

## Tables

Five tables, exactly as specified: `households`, `people`, `accounts`,
`account_snapshots`, `forecast_snapshots` — see `schema.ts` for the full column
list and the reasoning behind each nullability choice.

Two invariants enforced at the data-access layer (and, where practical, by a DB
`CHECK` constraint too — see `accounts.test.ts` for tests that bypass the
data-access layer entirely to prove the DB itself enforces them):

- **`pot_category` is always derived from `account_type`**, never a raw caller
  input — see `accountTypeToPotCategory()` in `accounts.ts`.
- **`account_snapshots` is append-only.** This module exposes no update or
  delete for it, only `insertSnapshot()` and reads. A past period is never
  rewritten, even when "catching up" several months at once.

Growth for any period is always `end_balance − start_balance − money_in +
transfer_out` (`periodGrowth()` in `accountSnapshots.ts`) — never a raw balance
diff. See the test file for a worked example of exactly the distortion this
avoids (a withdrawal read as a market loss under a naive diff).

## Local dev / tests

No credentials needed. `client.ts` falls back to a local libSQL file
(`.data/wodge-app.db`, gitignored) whenever `TURSO_DATABASE_URL` is unset.
Tests use `createMigratedTestDb()` (`testHelpers.ts`) — a fresh temp file,
freshly migrated, per test suite.

```bash
pnpm test src/server/db          # run just the db tests
```

## Migrations

```bash
pnpm db:generate    # after changing schema.ts — writes drizzle/000N_*.sql
pnpm db:migrate     # applies pending migrations (see note below)
pnpm db:studio      # browse the DB — drizzle-kit's own UI
```

`pnpm db:migrate` runs `scripts/db-migrate.ts` via `tsx`, **not**
`drizzle-kit migrate` directly — the CLI's own migrator hangs against local
`file:` targets in this toolchain. The script uses `drizzle-orm`'s migrator
function directly against whichever client `client.ts` resolves to, which
works reliably against both a local file and the real Turso database.

## Known limitation: Turso reachability from this sandbox

At the time Phase 1 was built, this session's network egress policy does not
allow `libsql://thewodge-ashleyjellis.aws-eu-west-1.turso.io` — the proxy
returns a `403 Host not in allowlist` (confirmed via
`/root/.ccr/__agentproxy/status`; this is a deliberate organisation policy
denial, not a transient failure). The schema, migration, and every
data-access function are fully verified against a real, migrated libSQL
database (see "Local dev / tests" above) — only the *live Turso* connection
itself is unverified from within this sandbox.

To apply the migration to the real database, run `pnpm db:migrate` from an
environment that can reach Turso (a local machine, CI, or a session with that
host allowlisted) with `.env` populated. Nothing about the schema or code
needs to change first.
