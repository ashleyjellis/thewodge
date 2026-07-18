import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

// Migrations for the logged-in experience's database (Turso/libSQL). Checked into
// the repo under drizzle/. Falls back to a local file when no Turso URL is set, so
// `pnpm db:generate` / `pnpm db:migrate` work without live credentials too.
export default defineConfig({
  dialect: 'turso',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? `file:${process.env.WODGE_LOCAL_DB_PATH ?? '.data/wodge-app.db'}`,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
})
