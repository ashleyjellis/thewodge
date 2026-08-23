/**
 * Turso/libSQL client factory for the performance tracker database —
 * server-only.
 *
 * Mirrors src/server/archiveDb/client.ts, pointed at a third database with
 * its own env prefix (TRACKER_*). See schema.ts for why this is separate from
 * both the household app and the pricing archive.
 *
 * Real Turso when TRACKER_TURSO_DATABASE_URL is set; otherwise a local libSQL
 * file (.data/wodge-tracker.db, gitignored) so the whole tracker — schema,
 * engine, demo data, admin and public pages — runs with no credentials and no
 * network. TRACKER_FORCE_LOCAL_DB=1 forces the local file even when
 * credentials are present.
 */
import 'dotenv/config'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createClient } from '@libsql/client'
import type { LibsqlClient } from '../libsqlClientType.js'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import * as schema from './schema.js'

export type TrackerDb = LibSQLDatabase<typeof schema>

let client: LibsqlClient | null = null
let db: TrackerDb | null = null

function buildClient(): LibsqlClient {
  const forceLocal = process.env.TRACKER_FORCE_LOCAL_DB === '1'
  const url = forceLocal ? undefined : process.env.TRACKER_TURSO_DATABASE_URL
  if (url) {
    return createClient({
      url,
      authToken: process.env.TRACKER_TURSO_AUTH_TOKEN,
      encryptionKey: process.env.TRACKER_TURSO_ENCRYPTION_KEY,
    })
  }
  // The local-file fallback is what makes development work with no setup.
  // In production it is always a misconfiguration: a serverless filesystem is
  // read-only and ephemeral, so this would either throw something obscure or
  // silently serve an empty database — which presents as "nothing tracked
  // yet" and sends someone looking for a bug in the wrong place entirely.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'TRACKER_TURSO_DATABASE_URL is not set. The tracker database must be configured in production; ' +
        'the local-file fallback only exists for development.',
    )
  }

  const path = process.env.TRACKER_LOCAL_DB_PATH ?? '.data/wodge-tracker.db'
  // The local file lives under .data/, which is gitignored — so on a fresh
  // clone the directory does not exist yet and libSQL fails to open with a
  // bare SQLITE_CANTOPEN that says nothing about the cause. Create it.
  mkdirSync(dirname(path), { recursive: true })
  return createClient({ url: `file:${path}` })
}

/** The shared tracker-db instance for this process. Lazily created on first use. */
export function getTrackerDb(): TrackerDb {
  if (!db) {
    client = buildClient()
    db = drizzle(client, { schema })
  }
  return db
}

/** A fresh, independent tracker-db instance — used by tests that want isolation. */
export function createTestTrackerDb(path: string): TrackerDb {
  const testClient = createClient({ url: `file:${path}` })
  return drizzle(testClient, { schema })
}

export async function closeTrackerDb(): Promise<void> {
  client?.close()
  client = null
  db = null
}
