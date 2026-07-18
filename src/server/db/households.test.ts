import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMigratedTestDb } from './testHelpers'
import { createHousehold, getHousehold, getOrCreateHousehold, updateHousehold } from './households'
import type { Db } from './client'

describe('households', () => {
  let db: Db
  let cleanup: () => void

  beforeEach(async () => {
    ;({ db, cleanup } = await createMigratedTestDb())
  })
  afterEach(() => cleanup())

  it('has no household on a fresh database', async () => {
    expect(await getHousehold(db)).toBeNull()
  })

  it('creates a household with the documented defaults', async () => {
    const h = await createHousehold(db)
    expect(h.retirementAge).toBe(58)
    expect(h.realReturn).toBe(0.07)
    expect(h.cashReturn).toBe(0.045)
    expect(h.swr).toBe(0.04)
    expect(h.targetIncomeToday).toBeNull()
    expect(h.id).toBeTruthy()
    expect(h.createdAt).toBeTruthy()
  })

  it('accepts overrides at creation', async () => {
    const h = await createHousehold(db, { retirementAge: 60, targetIncomeToday: 65_000 })
    expect(h.retirementAge).toBe(60)
    expect(h.targetIncomeToday).toBe(65_000)
  })

  it('getOrCreateHousehold creates once, then returns the same row', async () => {
    const first = await getOrCreateHousehold(db)
    const second = await getOrCreateHousehold(db)
    expect(second.id).toBe(first.id)
  })

  it('updateHousehold patches only the given fields', async () => {
    const h = await createHousehold(db)
    await updateHousehold(db, h.id, { retirementAge: 62 })
    const reloaded = await getHousehold(db)
    expect(reloaded!.retirementAge).toBe(62)
    expect(reloaded!.realReturn).toBe(0.07) // untouched
  })
})
