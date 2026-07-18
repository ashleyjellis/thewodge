import { defineConfig } from 'drizzle-kit'

// Migrations for the Turso/libSQL server store (spec §11). Checked into the repo.
// Inactive in v1 (financials are local) — run only once a Turso DB is provisioned.
export default defineConfig({
  dialect: 'turso',
  schema: './src/lib/server/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? 'file:./.data/wodge.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
})
