import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMigratedTestDb } from './testHelpers'
import { createHousehold } from './households'
import { createPerson } from './people'
import {
  getLatestSalaryChange,
  insertSalaryChange,
  listSalaryChanges,
  listSalaryChangesForHousehold,
} from './salaryChanges'
import type { Db } from './client'

describe('salaryChanges', () => {
  let db: Db
  let cleanup: () => void

  beforeAll(async () => {
    ;({ db, cleanup } = await createMigratedTestDb())
  })
  afterAll(() => cleanup())

  it('inserts a salary change tied to a person', async () => {
    const h = await createHousehold(db)
    const p = await createPerson(db, { householdId: h.id, name: 'Ashley', age: 31, salary: 93_500 })
    const change = await insertSalaryChange(db, { personId: p.id, effectiveYear: 2027, salary: 96_305 })
    expect(change.personId).toBe(p.id)
    expect(change.effectiveYear).toBe(2027)
    expect(change.salary).toBe(96_305)
  })

  it('lists a person\'s changes in year order regardless of insert order', async () => {
    const h = await createHousehold(db)
    const p = await createPerson(db, { householdId: h.id, name: 'Ashley', age: 31 })
    await insertSalaryChange(db, { personId: p.id, effectiveYear: 2029, salary: 100_000 })
    await insertSalaryChange(db, { personId: p.id, effectiveYear: 2027, salary: 96_000 })
    const changes = await listSalaryChanges(db, p.id)
    expect(changes.map((c) => c.effectiveYear)).toEqual([2027, 2029])
  })

  it('another person\'s changes never leak into a different person\'s list', async () => {
    const h = await createHousehold(db)
    const a = await createPerson(db, { householdId: h.id, name: 'Ashley', age: 31 })
    const c = await createPerson(db, { householdId: h.id, name: 'Charlotte', age: 31 })
    await insertSalaryChange(db, { personId: a.id, effectiveYear: 2027, salary: 96_000 })
    await insertSalaryChange(db, { personId: c.id, effectiveYear: 2027, salary: 45_000 })
    expect(await listSalaryChanges(db, a.id)).toHaveLength(1)
    expect(await listSalaryChanges(db, c.id)).toHaveLength(1)
  })

  it('returns the most recent change for a person', async () => {
    const h = await createHousehold(db)
    const p = await createPerson(db, { householdId: h.id, name: 'Ashley', age: 31 })
    await insertSalaryChange(db, { personId: p.id, effectiveYear: 2027, salary: 96_000 })
    await insertSalaryChange(db, { personId: p.id, effectiveYear: 2029, salary: 102_000 })
    const latest = await getLatestSalaryChange(db, p.id)
    expect(latest!.effectiveYear).toBe(2029)
    expect(latest!.salary).toBe(102_000)
  })

  it('null when a person has no changes yet', async () => {
    const h = await createHousehold(db)
    const p = await createPerson(db, { householdId: h.id, name: 'Ashley', age: 31 })
    expect(await getLatestSalaryChange(db, p.id)).toBeNull()
  })

  it('pools every person\'s changes for a household in one call', async () => {
    const h = await createHousehold(db)
    const a = await createPerson(db, { householdId: h.id, name: 'Ashley', age: 31 })
    const c = await createPerson(db, { householdId: h.id, name: 'Charlotte', age: 31 })
    const other = await createHousehold(db)
    const stranger = await createPerson(db, { householdId: other.id, name: 'Stranger', age: 40 })
    await insertSalaryChange(db, { personId: a.id, effectiveYear: 2027, salary: 96_000 })
    await insertSalaryChange(db, { personId: c.id, effectiveYear: 2028, salary: 46_000 })
    await insertSalaryChange(db, { personId: stranger.id, effectiveYear: 2027, salary: 1 })
    const changes = await listSalaryChangesForHousehold(db, h.id)
    expect(changes).toHaveLength(2)
    expect(changes.map((c) => c.effectiveYear)).toEqual([2027, 2028])
  })
})
