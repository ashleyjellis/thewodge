/**
 * Households. One household per signed-in user for v1 — there is deliberately no
 * user/auth linkage column (see schema.ts). For v1, "the household" is simply the
 * one row that exists; getOrCreateHousehold() is the entry point every later
 * phase should use rather than assuming a row exists.
 */
import { eq } from 'drizzle-orm'
import type { Db } from './client.js'
import { households } from './schema.js'

export type Household = typeof households.$inferSelect

export type HouseholdPatch = Partial<
  Pick<Household, 'retirementAge' | 'targetIncomeToday' | 'realReturn' | 'cashReturn' | 'swr' | 'downYearsCount'>
>

export async function getHousehold(db: Db): Promise<Household | null> {
  const rows = await db.select().from(households).limit(1)
  return rows[0] ?? null
}

export async function createHousehold(db: Db, input: HouseholdPatch = {}): Promise<Household> {
  const row: Household = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    // matches the free tool's TARGET_AGE (src/config.ts) — not re-imported
    // here since that file is client-only (uses import.meta.env)
    retirementAge: input.retirementAge ?? 60,
    targetIncomeToday: input.targetIncomeToday ?? null,
    realReturn: input.realReturn ?? 0.07,
    cashReturn: input.cashReturn ?? 0.045,
    swr: input.swr ?? 0.04,
    downYearsCount: input.downYearsCount ?? 0,
  }
  await db.insert(households).values(row)
  return row
}

export async function getOrCreateHousehold(db: Db): Promise<Household> {
  const existing = await getHousehold(db)
  return existing ?? createHousehold(db)
}

export async function updateHousehold(
  db: Db,
  id: string,
  patch: HouseholdPatch,
): Promise<void> {
  await db.update(households).set(patch).where(eq(households.id, id))
}
