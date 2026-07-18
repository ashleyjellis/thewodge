/**
 * Turso/libSQL client factory — server-only.
 *
 * Reads connection details from env. When TURSO_DATABASE_URL is set, connects to
 * the real Turso database (encryption at rest whenever TURSO_ENCRYPTION_KEY is
 * also present). When unset — or when WODGE_FORCE_LOCAL_DB=1 overrides it — falls
 * back to a local libSQL file (.data/wodge-app.db, gitignored) — no network
 * required, used by tests and local dev. Same schema, same query functions,
 * either way.
 */
import 'dotenv/config'
import { createClient, type Client } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import * as schema from './schema'

export type Db = LibSQLDatabase<typeof schema>

let client: Client | null = null
let db: Db | null = null

function buildClient(): Client {
  // explicit escape hatch: force local file mode even when Turso credentials are
  // present in .env — handy when working somewhere that can't reach Turso's
  // network, without having to move .env aside.
  const forceLocal = process.env.WODGE_FORCE_LOCAL_DB === '1'
  const url = forceLocal ? undefined : process.env.TURSO_DATABASE_URL
  if (url) {
    return createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
      // encryption at rest whenever a key is provided (spec §8 equivalent for this DB)
      encryptionKey: process.env.TURSO_ENCRYPTION_KEY,
    })
  }
  // local dev / tests — no network, no credentials required
  const path = process.env.WODGE_LOCAL_DB_PATH ?? '.data/wodge-app.db'
  return createClient({ url: `file:${path}` })
}

/** The shared db instance for this process. Lazily created on first use. */
export function getDb(): Db {
  if (!db) {
    client = buildClient()
    db = drizzle(client, { schema })
  }
  return db
}

/** A fresh, independent db instance — used by tests that want isolation. */
export function createTestDb(path: string): Db {
  const testClient = createClient({ url: `file:${path}` })
  return drizzle(testClient, { schema })
}

export async function closeDb(): Promise<void> {
  client?.close()
  client = null
  db = null
}
