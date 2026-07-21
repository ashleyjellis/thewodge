/**
 * Salary changes — append-only, same reasoning as account_snapshots: an
 * actual salary confirmed for a given year is a historical fact, never
 * silently rewritten. Read by salary.ts to resolve the effective salary for
 * any year, superseding the person's baseline salary + assumed growth rate
 * from the year it lands onward.
 */
import { desc, eq } from 'drizzle-orm'
import type { Db } from './client.js'
import { people, salaryChanges } from './schema.js'

export type SalaryChange = typeof salaryChanges.$inferSelect

export type NewSalaryChange = {
  personId: string
  effectiveYear: number
  salary: number
  note?: string | null
}

export async function insertSalaryChange(db: Db, input: NewSalaryChange): Promise<SalaryChange> {
  const row: SalaryChange = {
    id: crypto.randomUUID(),
    personId: input.personId,
    effectiveYear: input.effectiveYear,
    salary: input.salary,
    note: input.note ?? null,
    createdAt: new Date().toISOString(),
  }
  await db.insert(salaryChanges).values(row)
  return row
}

export async function listSalaryChanges(db: Db, personId: string): Promise<SalaryChange[]> {
  const rows = await db.select().from(salaryChanges).where(eq(salaryChanges.personId, personId))
  return rows.sort((a, b) => a.effectiveYear - b.effectiveYear)
}

/**
 * Every salary change across every person in a household, in one query —
 * mirrors listSnapshotsForHousehold's reasoning (the caller almost always
 * wants the whole household's view, not one person at a time).
 */
export async function listSalaryChangesForHousehold(
  db: Db,
  householdId: string,
): Promise<SalaryChange[]> {
  const rows = await db
    .select({ change: salaryChanges })
    .from(salaryChanges)
    .innerJoin(people, eq(salaryChanges.personId, people.id))
    .where(eq(people.householdId, householdId))
  return rows.map((r) => r.change).sort((a, b) => a.effectiveYear - b.effectiveYear)
}

export async function getLatestSalaryChange(db: Db, personId: string): Promise<SalaryChange | null> {
  const rows = await db
    .select()
    .from(salaryChanges)
    .where(eq(salaryChanges.personId, personId))
    .orderBy(desc(salaryChanges.effectiveYear))
    .limit(1)
  return rows[0] ?? null
}
