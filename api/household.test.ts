import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMigratedTestDb } from '../src/server/db/testHelpers'
import type { Db } from '../src/server/db/client'
import { handleHousehold } from './household'
import { fakeReq, fakeRes } from './_lib/testHttp'

describe('GET /api/household', () => {
  let db: Db
  let cleanup: () => void

  beforeAll(async () => {
    ;({ db, cleanup } = await createMigratedTestDb())
  })
  afterAll(() => cleanup())

  it('creates and returns a household with defaults, and an empty people list', async () => {
    const { res, status, body } = fakeRes()
    await handleHousehold(db, fakeReq({ method: 'GET' }), res)
    expect(status()).toBe(200)
    const b = body() as { ok: boolean; household: { retirementAge: number }; people: unknown[] }
    expect(b.ok).toBe(true)
    expect(b.household.retirementAge).toBe(60) // matches the free tool's TARGET_AGE (src/config.ts)
    expect(b.people).toEqual([])
  })

  it('returns the SAME household on a second call (get-or-create)', async () => {
    const first = fakeRes()
    await handleHousehold(db, fakeReq({ method: 'GET' }), first.res)
    const second = fakeRes()
    await handleHousehold(db, fakeReq({ method: 'GET' }), second.res)
    const firstBody = first.body() as { household: { id: string } }
    const secondBody = second.body() as { household: { id: string } }
    expect(secondBody.household.id).toBe(firstBody.household.id)
  })
})

describe('PATCH /api/household', () => {
  let db: Db
  let cleanup: () => void

  beforeAll(async () => {
    ;({ db, cleanup } = await createMigratedTestDb())
  })
  afterAll(() => cleanup())

  it('requires an id', async () => {
    const { res, status, body } = fakeRes()
    await handleHousehold(db, fakeReq({ method: 'PATCH', body: { retirementAge: 60 } }), res)
    expect(status()).toBe(400)
    expect((body() as { ok: boolean }).ok).toBe(false)
  })

  it('updates the given fields and leaves others untouched', async () => {
    const getRes = fakeRes()
    await handleHousehold(db, fakeReq({ method: 'GET' }), getRes.res)
    const { id } = (getRes.body() as { household: { id: string } }).household

    const patchRes = fakeRes()
    await handleHousehold(
      db,
      fakeReq({ method: 'PATCH', body: { id, retirementAge: 60, targetIncomeToday: 65_000 } }),
      patchRes.res,
    )
    expect(patchRes.status()).toBe(200)

    const reGet = fakeRes()
    await handleHousehold(db, fakeReq({ method: 'GET' }), reGet.res)
    const h = (reGet.body() as { household: { retirementAge: number; targetIncomeToday: number; realReturn: number } }).household
    expect(h.retirementAge).toBe(60)
    expect(h.targetIncomeToday).toBe(65_000)
    expect(h.realReturn).toBe(0.07) // untouched
  })

  it('defaults downYearsCount to 0, and accepts an update, clamped to a non-negative integer', async () => {
    const getRes = fakeRes()
    await handleHousehold(db, fakeReq({ method: 'GET' }), getRes.res)
    const { id, downYearsCount } = (getRes.body() as { household: { id: string; downYearsCount: number } })
      .household
    expect(downYearsCount).toBe(0)

    const patchRes = fakeRes()
    await handleHousehold(db, fakeReq({ method: 'PATCH', body: { id, downYearsCount: -3.7 } }), patchRes.res)
    expect(patchRes.status()).toBe(200)

    const reGet = fakeRes()
    await handleHousehold(db, fakeReq({ method: 'GET' }), reGet.res)
    expect((reGet.body() as { household: { downYearsCount: number } }).household.downYearsCount).toBe(0)
  })
})

describe('unsupported methods', () => {
  it('returns 405 for DELETE', async () => {
    const { db, cleanup } = await createMigratedTestDb()
    const { res, status } = fakeRes()
    await handleHousehold(db, fakeReq({ method: 'DELETE' }), res)
    expect(status()).toBe(405)
    cleanup()
  })
})
