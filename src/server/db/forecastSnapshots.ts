/**
 * Forecast snapshots — the baseline/actuals/replan model. Append-only: this
 * module exposes no update or delete, only insert and read. A baseline or replan
 * is created only on explicit user action (or the one-time auto-creation on first
 * Forecast visit — a later phase), never silently on account/people changes.
 */
import { eq } from 'drizzle-orm'
import type { Db } from './client.js'
import { forecastSnapshots, type ForecastSnapshotType } from './schema.js'

export type ForecastSnapshot = typeof forecastSnapshots.$inferSelect

export async function listForecastSnapshots(
  db: Db,
  householdId: string,
): Promise<ForecastSnapshot[]> {
  const rows = await db
    .select()
    .from(forecastSnapshots)
    .where(eq(forecastSnapshots.householdId, householdId))
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/**
 * The current plan-of-record: the most recent baseline OR replan — a replan
 * itself becomes the new plan-of-record the moment it's created.
 */
export async function getCurrentBaseline(
  db: Db,
  householdId: string,
): Promise<ForecastSnapshot | null> {
  const rows = await listForecastSnapshots(db, householdId)
  return rows.length > 0 ? rows[rows.length - 1]! : null
}

/**
 * The very first baseline ever created for this household. Stays the fixed
 * origin line even after a replan, so the faded-fork view always has something
 * to draw against (spec §4 — "the fork must stay visible, never disappear").
 */
export async function getOriginalBaseline(
  db: Db,
  householdId: string,
): Promise<ForecastSnapshot | null> {
  const rows = await listForecastSnapshots(db, householdId)
  return rows.find((r) => r.type === 'baseline') ?? null
}

export type NewForecastSnapshot = {
  householdId: string
  type: ForecastSnapshotType
  /** full serialised Household + People + Accounts state at this moment */
  householdStateJson: string
  note?: string | null
}

export async function insertForecastSnapshot(
  db: Db,
  input: NewForecastSnapshot,
): Promise<ForecastSnapshot> {
  const row: ForecastSnapshot = {
    id: crypto.randomUUID(),
    householdId: input.householdId,
    createdAt: new Date().toISOString(),
    type: input.type,
    householdStateJson: input.householdStateJson,
    note: input.note ?? null,
  }
  await db.insert(forecastSnapshots).values(row)
  return row
}

export async function createBaseline(
  db: Db,
  householdId: string,
  householdStateJson: string,
  note = 'your plan',
): Promise<ForecastSnapshot> {
  return insertForecastSnapshot(db, { householdId, type: 'baseline', householdStateJson, note })
}

/** A replan always requires a short note explaining what changed (spec §4). */
export async function createReplan(
  db: Db,
  householdId: string,
  householdStateJson: string,
  note: string,
): Promise<ForecastSnapshot> {
  if (!note.trim()) throw new Error('A replan requires a short note')
  return insertForecastSnapshot(db, {
    householdId,
    type: 'replan',
    householdStateJson,
    note: note.trim(),
  })
}

/**
 * A checkpoint is a low-friction check-in — one click, an optional label,
 * never a required note. Like a replan it becomes the new plan-of-record
 * (see getCurrentBaseline), it just doesn't carry the "I deliberately
 * changed my plan" weight a replan does.
 */
export async function createCheckpoint(
  db: Db,
  householdId: string,
  householdStateJson: string,
  label?: string | null,
): Promise<ForecastSnapshot> {
  return insertForecastSnapshot(db, {
    householdId,
    type: 'checkpoint',
    householdStateJson,
    note: label?.trim() || null,
  })
}
