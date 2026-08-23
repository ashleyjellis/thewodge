/**
 * Test-only helper: a fresh, freshly-migrated tracker database per test suite.
 *
 * Mirrors src/server/db/testHelpers.ts, pointed at the tracker's own
 * migrations folder. Running the real migrations rather than pushing the
 * schema means these tests also prove the migrations apply cleanly, and that
 * the CHECK constraints the schema declares are actually enforced by SQLite
 * rather than only described in TypeScript.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { createTestTrackerDb, type TrackerDb } from './client'

export async function createMigratedTrackerDb(): Promise<{
  db: TrackerDb
  cleanup: () => void
}> {
  const dir = mkdtempSync(join(tmpdir(), 'wodge-tracker-test-'))
  const path = join(dir, 'test.db')
  const db = createTestTrackerDb(path)
  await migrate(db, { migrationsFolder: './drizzle/tracker' })
  return {
    db,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}
