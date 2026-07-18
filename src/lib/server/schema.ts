/**
 * Drizzle schema (SQLite dialect) — maps the §2 data model to Turso/libSQL (§11).
 *
 * Server-only. Never imported by client code. Snapshots are append-only: the store
 * exposes no update/delete for them (§2, §5). The Household state is stored as a
 * JSON document in `state` — a record to reproduce, not something to query into;
 * only `email` and coarse `household` rows are ever queried.
 *
 * Encryption at rest (libSQL encryptionKey / SQLCipher) is enabled on any database
 * holding a financial field, primary region in the EU (§8).
 */
import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { Assumptions, Household, SnapshotType } from '../calc/types'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
})

export const households = sqliteTable('households', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  retirementAge: integer('retirement_age').notNull(),
  targetIncomeToday: integer('target_income_today').notNull(),
  assumptions: text('assumptions', { mode: 'json' })
    .$type<Assumptions>()
    .notNull(),
  /** the live-edited working draft (full Household JSON), pre-snapshot */
  draftState: text('draft_state', { mode: 'json' }).$type<Household>(),
  /** the plan-of-record snapshot; moves only on a deliberate replan (§5) */
  baselineSnapshotId: text('baseline_snapshot_id'),
})

export const snapshots = sqliteTable('snapshots', {
  id: text('id').primaryKey(),
  householdId: text('household_id')
    .notNull()
    .references(() => households.id),
  type: text('type').$type<SnapshotType>().notNull(),
  /** the immutable, deep-copied Household state as JSON */
  state: text('state', { mode: 'json' }).$type<Household>().notNull(),
  note: text('note').notNull().default(''),
  timestamp: text('timestamp').notNull(),
})

export type UserRow = typeof users.$inferSelect
export type HouseholdRow = typeof households.$inferSelect
export type SnapshotRow = typeof snapshots.$inferSelect
