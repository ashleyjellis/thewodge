/**
 * Applies pending migrations from drizzle/archive/ against whichever archive
 * database client.ts resolves to (real archive Turso when
 * ARCHIVE_TURSO_DATABASE_URL is set, otherwise a local libSQL file). Mirrors
 * scripts/db-migrate.ts exactly — bypasses `drizzle-kit migrate`, which
 * hangs against local `file:` targets in this toolchain — drizzle-orm's own
 * migrator is used directly instead.
 */
import 'dotenv/config'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { getArchiveDb } from '../src/server/archiveDb/client'

const db = getArchiveDb()
const usingLocal = process.env.ARCHIVE_FORCE_LOCAL_DB === '1' || !process.env.ARCHIVE_TURSO_DATABASE_URL
const target = usingLocal
  ? `local file (${process.env.ARCHIVE_LOCAL_DB_PATH ?? '.data/wodge-archive.db'})`
  : process.env.ARCHIVE_TURSO_DATABASE_URL
console.log(`[archive-db-migrate] applying drizzle/archive/ migrations to ${target}`)

await migrate(db, { migrationsFolder: './drizzle/archive' })

console.log('[archive-db-migrate] done')
process.exit(0)
