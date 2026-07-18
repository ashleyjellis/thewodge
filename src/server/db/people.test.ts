import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMigratedTestDb } from './testHelpers'
import { createHousehold } from './households'
import { createPerson, getPerson, HouseholdFullError, listPeople, updatePerson } from './people'
import type { Db } from './client'

describe('people', () => {
  let db: Db
  let cleanup: () => void

  beforeAll(async () => {
    ;({ db, cleanup } = await createMigratedTestDb())
  })
  afterAll(() => cleanup())

  it('creates a person with the household relationship', async () => {
    const h = await createHousehold(db)
    const p = await createPerson(db, { householdId: h.id, name: 'Sam', age: 36 })
    expect(p.householdId).toBe(h.id)
    expect(p.name).toBe('Sam')
    expect(p.salary).toBeNull()
  })

  it('accepts salary, bonus and employer pension percentages', async () => {
    const h = await createHousehold(db)
    const p = await createPerson(db, {
      householdId: h.id,
      name: 'Alex',
      age: 34,
      salary: 88_000,
      bonus: 12_000,
      employerPensionUserPct: 0.05,
      employerPensionMatchPct: 0.05,
      employerPensionAdditionalPct: 0.03,
    })
    expect(p.salary).toBe(88_000)
    expect(p.employerPensionMatchPct).toBe(0.05)
  })

  it('allows exactly two people per household, rejects a third', async () => {
    const h = await createHousehold(db)
    await createPerson(db, { householdId: h.id, name: 'A', age: 30 })
    await createPerson(db, { householdId: h.id, name: 'B', age: 31 })
    await expect(
      createPerson(db, { householdId: h.id, name: 'C', age: 32 }),
    ).rejects.toBeInstanceOf(HouseholdFullError)
    expect(await listPeople(db, h.id)).toHaveLength(2)
  })

  it('a different household is unaffected by another household being full', async () => {
    const h1 = await createHousehold(db)
    const h2 = await createHousehold(db)
    await createPerson(db, { householdId: h1.id, name: 'A', age: 30 })
    await createPerson(db, { householdId: h1.id, name: 'B', age: 31 })
    // h2 should still accept people even though h1 is full
    const p = await createPerson(db, { householdId: h2.id, name: 'C', age: 32 })
    expect(p.householdId).toBe(h2.id)
  })

  it('updates only the given fields', async () => {
    const h = await createHousehold(db)
    const p = await createPerson(db, { householdId: h.id, name: 'Sam', age: 36, salary: 80_000 })
    await updatePerson(db, p.id, { age: 37 })
    const reloaded = await getPerson(db, p.id)
    expect(reloaded!.age).toBe(37)
    expect(reloaded!.salary).toBe(80_000) // untouched
  })
})
