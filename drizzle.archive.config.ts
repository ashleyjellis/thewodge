import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

// Migrations for the provider pricing archive's database (Turso/libSQL) — a
// SEPARATE database from drizzle.config.ts's household app. Checked into the
// repo under drizzle/archive/. Falls back to a local file when no archive
// Turso URL is set, so `pnpm archive:db:generate` / `archive:db:migrate`
// work without live credentials too.
export default defineConfig({
  dialect: 'turso',
  schema: './src/server/archiveDb/schema.ts',
  out: './drizzle/archive',
  dbCredentials: {
    url:
      process.env.ARCHIVE_TURSO_DATABASE_URL ??
      `file:${process.env.ARCHIVE_LOCAL_DB_PATH ?? '.data/wodge-archive.db'}`,
    authToken: process.env.ARCHIVE_TURSO_AUTH_TOKEN,
  },
})
