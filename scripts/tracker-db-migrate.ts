/**
 * Applies pending migrations from drizzle/tracker/ against whichever tracker
 * database client.ts resolves to (real Turso when TRACKER_TURSO_DATABASE_URL
 * is set, otherwise a local libSQL file). Mirrors scripts/db-migrate.ts and
 * scripts/archive-db-migrate.ts — bypasses `drizzle-kit migrate`, which hangs
 * against local `file:` targets in this toolchain; drizzle-orm's own migrator
 * is used directly instead.
 */
import 'dotenv/config'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { getTrackerDb } from '../src/server/trackerDb/client'

const db = getTrackerDb()
const usingLocal =
  process.env.TRACKER_FORCE_LOCAL_DB === '1' || !process.env.TRACKER_TURSO_DATABASE_URL
const target = usingLocal
  ? `local file (${process.env.TRACKER_LOCAL_DB_PATH ?? '.data/wodge-tracker.db'})`
  : process.env.TRACKER_TURSO_DATABASE_URL
console.log(`[tracker-db-migrate] applying drizzle/tracker/ migrations to ${target}`)

await migrate(db, { migrationsFolder: './drizzle/tracker' })

console.log('[tracker-db-migrate] done')
process.exit(0)
