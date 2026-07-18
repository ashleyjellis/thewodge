import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMigratedTestDb } from './testHelpers'
import { createHousehold } from './households'
import {
  createBaseline,
  createReplan,
  getCurrentBaseline,
  getOriginalBaseline,
  listForecastSnapshots,
} from './forecastSnapshots'
import type { Db } from './client'

describe('forecast_snapshots (append-only, against a real migrated database)', () => {
  let db: Db
  let cleanup: () => void
  let householdId: string

  beforeAll(async () => {
    ;({ db, cleanup } = await createMigratedTestDb())
    const h = await createHousehold(db)
    householdId = h.id
  })
  afterAll(() => cleanup())

  it('has no baseline before one is created', async () => {
    expect(await getCurrentBaseline(db, householdId)).toBeNull()
  })

  it('creates a baseline with a default note', async () => {
    const b = await createBaseline(db, householdId, JSON.stringify({ ok: true }))
    expect(b.type).toBe('baseline')
    expect(b.note).toBe('your plan')
    expect(b.householdStateJson).toBe(JSON.stringify({ ok: true }))
  })

  it('the baseline becomes the current plan-of-record', async () => {
    const current = await getCurrentBaseline(db, householdId)
    expect(current!.type).toBe('baseline')
  })

  it('createReplan requires a non-empty note', async () => {
    await expect(createReplan(db, householdId, '{}', '')).rejects.toThrow()
    await expect(createReplan(db, householdId, '{}', '   ')).rejects.toThrow()
  })

  it('a replan becomes the new plan-of-record, but the original baseline stays visible', async () => {
    const original = await getOriginalBaseline(db, householdId)
    await createReplan(db, householdId, JSON.stringify({ replanned: true }), 'bought the house')

    const current = await getCurrentBaseline(db, householdId)
    expect(current!.type).toBe('replan')
    expect(current!.note).toBe('bought the house')

    // the fork must stay visible — the ORIGINAL baseline is still retrievable
    const stillOriginal = await getOriginalBaseline(db, householdId)
    expect(stillOriginal!.id).toBe(original!.id)
    expect(stillOriginal!.type).toBe('baseline')
  })

  it('getOriginalBaseline stays the same even after a second replan', async () => {
    const original = await getOriginalBaseline(db, householdId)
    await createReplan(db, householdId, '{}', 'second child')
    const stillOriginal = await getOriginalBaseline(db, householdId)
    expect(stillOriginal!.id).toBe(original!.id)
  })

  it('lists every snapshot in creation order, nothing ever removed', async () => {
    const all = await listForecastSnapshots(db, householdId)
    expect(all.length).toBeGreaterThanOrEqual(3) // baseline + 2 replans from above
    const sorted = [...all].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    expect(all.map((s) => s.id)).toEqual(sorted.map((s) => s.id))
  })
})
