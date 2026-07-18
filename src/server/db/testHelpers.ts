/**
 * Test-only helper: a fresh, freshly-migrated local libSQL file per test suite —
 * proves the migration applies cleanly and gives full isolation between test
 * files. Not part of the public data-access barrel (not exported from index.ts).
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { createTestDb, type Db } from './client'

export async function createMigratedTestDb(): Promise<{ db: Db; cleanup: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'wodge-db-test-'))
  const path = join(dir, 'test.db')
  const db = createTestDb(path)
  await migrate(db, { migrationsFolder: './drizzle' })
  return {
    db,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}
