/**
 * Turso/libSQL client factory for the archive database — server-only.
 *
 * Mirrors src/server/db/client.ts exactly, pointed at a SEPARATE database
 * and env var prefix (ARCHIVE_*, not TURSO_*) — see schema.ts's top comment
 * for why this is a different database from the household app's.
 *
 * Reads connection details from env. When ARCHIVE_TURSO_DATABASE_URL is set,
 * connects to the real archive Turso database. When unset — or when
 * ARCHIVE_FORCE_LOCAL_DB=1 overrides it — falls back to a local libSQL file
 * (.data/wodge-archive.db, gitignored) — no network required, used by tests
 * and local dev. Same schema, same query functions, either way. The Python
 * pipeline's own db.py reads the same env vars and applies the same
 * fallback, so one set of credentials (or none, locally) covers both
 * languages.
 */
import 'dotenv/config'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createClient, type Client } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import * as schema from './schema.js'

export type ArchiveDb = LibSQLDatabase<typeof schema>

let client: Client | null = null
let db: ArchiveDb | null = null

function buildClient(): Client {
  const forceLocal = process.env.ARCHIVE_FORCE_LOCAL_DB === '1'
  const url = forceLocal ? undefined : process.env.ARCHIVE_TURSO_DATABASE_URL
  if (url) {
    return createClient({
      url,
      authToken: process.env.ARCHIVE_TURSO_AUTH_TOKEN,
      encryptionKey: process.env.ARCHIVE_TURSO_ENCRYPTION_KEY,
    })
  }
  const path = process.env.ARCHIVE_LOCAL_DB_PATH ?? '.data/wodge-archive.db'
  // The local file lives under .data/, which is gitignored — so on a fresh
  // clone the directory does not exist yet and libSQL fails to open with a
  // bare SQLITE_CANTOPEN that says nothing about the cause. Create it.
  mkdirSync(dirname(path), { recursive: true })
  return createClient({ url: `file:${path}` })
}

/** The shared archive-db instance for this process. Lazily created on first use. */
export function getArchiveDb(): ArchiveDb {
  if (!db) {
    client = buildClient()
    db = drizzle(client, { schema })
  }
  return db
}

/** A fresh, independent archive-db instance — used by tests that want isolation. */
export function createTestArchiveDb(path: string): ArchiveDb {
  const testClient = createClient({ url: `file:${path}` })
  return drizzle(testClient, { schema })
}

export async function closeArchiveDb(): Promise<void> {
  client?.close()
  client = null
  db = null
}
