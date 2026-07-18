/**
 * libSQL / Turso client factory (spec §11) — server-only.
 *
 * Reads connection + encryption details from env; they are never shipped to the
 * client. Encryption at rest is enabled whenever an `encryptionKey` is present, as
 * required for any database holding a financial field (§8). Provision the primary
 * in an EU region.
 *
 * This is the seam that promotes the app from local-first to server-side. It is not
 * activated in v1 (financials stay local) — it exists so the swap is a config
 * change, not a rewrite.
 */
import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'

export type Db = ReturnType<typeof drizzle<typeof schema>>

export function createDb(): Db {
  const url = process.env.TURSO_DATABASE_URL
  if (!url) {
    throw new Error(
      'TURSO_DATABASE_URL is not set — the server store is inactive in v1 (financials are local).',
    )
  }
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
    // encryption at rest for any DB holding financials (§8).
    encryptionKey: process.env.TURSO_ENCRYPTION_KEY,
  })
  return drizzle(client, { schema })
}
