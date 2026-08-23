import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

// Migrations for the performance tracker's database (Turso/libSQL) — a third
// database, separate from drizzle.config.ts (household app) and
// drizzle.archive.config.ts (pricing archive). Checked into the repo under
// drizzle/tracker/. Falls back to a local file when no tracker Turso URL is
// set, so `pnpm tracker:db:generate` / `tracker:db:migrate` work without live
// credentials too.
export default defineConfig({
  dialect: 'turso',
  schema: './src/server/trackerDb/schema.ts',
  out: './drizzle/tracker',
  dbCredentials: {
    url:
      process.env.TRACKER_TURSO_DATABASE_URL ??
      `file:${process.env.TRACKER_LOCAL_DB_PATH ?? '.data/wodge-tracker.db'}`,
    authToken: process.env.TRACKER_TURSO_AUTH_TOKEN,
  },
})
