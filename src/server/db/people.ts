/**
 * People. Up to two per household (enforced here, not by the schema — SQLite has
 * no clean way to constrain "count of rows per FK" at the DDL level).
 */
import { eq } from 'drizzle-orm'
import type { Db } from './client'
import { people } from './schema'

export type Person = typeof people.$inferSelect

export const MAX_PEOPLE_PER_HOUSEHOLD = 2

export class HouseholdFullError extends Error {
  constructor() {
    super(`A household can have at most ${MAX_PEOPLE_PER_HOUSEHOLD} people`)
  }
}

export type NewPerson = {
  householdId: string
  name: string
  age: number
  salary?: number | null
  bonus?: number | null
  employerPensionUserPct?: number | null
  employerPensionMatchPct?: number | null
  employerPensionAdditionalPct?: number | null
}

export async function listPeople(db: Db, householdId: string): Promise<Person[]> {
  return db.select().from(people).where(eq(people.householdId, householdId))
}

export async function createPerson(db: Db, input: NewPerson): Promise<Person> {
  const existing = await listPeople(db, input.householdId)
  if (existing.length >= MAX_PEOPLE_PER_HOUSEHOLD) throw new HouseholdFullError()

  const row: Person = {
    id: crypto.randomUUID(),
    householdId: input.householdId,
    name: input.name,
    age: input.age,
    salary: input.salary ?? null,
    bonus: input.bonus ?? null,
    employerPensionUserPct: input.employerPensionUserPct ?? null,
    employerPensionMatchPct: input.employerPensionMatchPct ?? null,
    employerPensionAdditionalPct: input.employerPensionAdditionalPct ?? null,
  }
  await db.insert(people).values(row)
  return row
}

export type PersonPatch = Partial<Omit<NewPerson, 'householdId'>>

export async function updatePerson(db: Db, id: string, patch: PersonPatch): Promise<void> {
  await db.update(people).set(patch).where(eq(people.id, id))
}

export async function getPerson(db: Db, id: string): Promise<Person | null> {
  const rows = await db.select().from(people).where(eq(people.id, id)).limit(1)
  return rows[0] ?? null
}
