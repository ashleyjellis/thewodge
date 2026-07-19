/**
 * Planned events — one-off amounts in or out of a pot at a specific year,
 * layered onto the live Plan table alongside contribution_changes. Same
 * editable/deletable reasoning as contributionChanges.ts.
 */
import { eq } from 'drizzle-orm'
import type { Db } from './client.js'
import { plannedEvents, type AccountOwner, type PotCategory } from './schema.js'

export type PlannedEventRow = typeof plannedEvents.$inferSelect

export type NewPlannedEvent = {
  householdId: string
  owner: AccountOwner
  potCategory: PotCategory
  year: number
  name: string
  /** positive = money in, negative = money out */
  amount: number
  note?: string | null
}

export async function listPlannedEvents(db: Db, householdId: string): Promise<PlannedEventRow[]> {
  return db.select().from(plannedEvents).where(eq(plannedEvents.householdId, householdId))
}

export async function createPlannedEvent(db: Db, input: NewPlannedEvent): Promise<PlannedEventRow> {
  const row: PlannedEventRow = {
    id: crypto.randomUUID(),
    householdId: input.householdId,
    owner: input.owner,
    potCategory: input.potCategory,
    year: input.year,
    name: input.name,
    amount: input.amount,
    note: input.note ?? null,
    createdAt: new Date().toISOString(),
  }
  await db.insert(plannedEvents).values(row)
  return row
}

export async function deletePlannedEvent(db: Db, id: string): Promise<void> {
  await db.delete(plannedEvents).where(eq(plannedEvents.id, id))
}
