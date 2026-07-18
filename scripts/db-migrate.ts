/**
 * Applies pending migrations from drizzle/ against whichever database client.ts
 * resolves to (real Turso when TURSO_DATABASE_URL is set, otherwise a local
 * libSQL file). Bypasses `drizzle-kit migrate`, which hangs against local `file:`
 * targets in this toolchain — drizzle-orm's own migrator is used directly instead.
 */
import 'dotenv/config'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { getDb } from '../src/server/db/client.ts'

const db = getDb()
const target = process.env.TURSO_DATABASE_URL ?? '(local file)'
console.log(`[db-migrate] applying drizzle/ migrations to ${target}`)

await migrate(db, { migrationsFolder: './drizzle' })

console.log('[db-migrate] done')
process.exit(0)
