import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMigratedTestDb } from '../src/server/db/testHelpers'
import { createHousehold } from '../src/server/db/households'
import { createPerson } from '../src/server/db/people'
import { createAccount } from '../src/server/db/accounts'
import { insertForecastSnapshot } from '../src/server/db/forecastSnapshots'
import type { Db } from '../src/server/db/client'
import { handleForecast } from './forecast'
import { fakeReq, fakeRes } from './_lib/testHttp'

describe('forecast API', () => {
  let db: Db
  let cleanup: () => void
  let householdId: string

  beforeAll(async () => {
    ;({ db, cleanup } = await createMigratedTestDb())
    householdId = (await createHousehold(db)).id
  })
  afterAll(() => cleanup())

  it('GET requires a householdId', async () => {
    const { res, status } = fakeRes()
    await handleForecast(db, fakeReq({ method: 'GET' }), res)
    expect(status()).toBe(400)
  })

  it('GET reports not ready when there are no people or accounts yet', async () => {
    const { res, status, body } = fakeRes()
    await handleForecast(db, fakeReq({ method: 'GET', query: { householdId } }), res)
    expect(status()).toBe(200)
    expect((body() as { ready: boolean }).ready).toBe(false)
  })

  it('POST refuses to replan before there is anything to forecast', async () => {
    const { res, status } = fakeRes()
    await handleForecast(
      db,
      fakeReq({ method: 'POST', body: { householdId, note: 'too early' } }),
      res,
    )
    expect(status()).toBe(400)
  })

  it('GET auto-creates a baseline on first visit once people + accounts exist', async () => {
    const personId = (await createPerson(db, { householdId, name: 'Sam', age: 36 })).id
    await createAccount(db, {
      householdId,
      personId,
      owner: 'person_a',
      provider: 'Aviva',
      accountType: 'pension',
      monthlyContribution: 500,
      openingBalance: 20_000,
    })

    const { res, status, body } = fakeRes()
    await handleForecast(db, fakeReq({ method: 'GET', query: { householdId } }), res)
    expect(status()).toBe(200)
    const data = body() as {
      ready: boolean
      current: { type: string; householdStateJson: string }
      original: { type: string }
    }
    expect(data.ready).toBe(true)
    expect(data.current.type).toBe('baseline')
    expect(data.original.type).toBe('baseline')
    const state = JSON.parse(data.current.householdStateJson)
    expect(state.total.pension).toBe(20_000)
    expect(state.total.pensionMonthly).toBe(500)
  })

  it('GET a second time reuses the same baseline rather than creating another', async () => {
    const first = fakeRes()
    await handleForecast(db, fakeReq({ method: 'GET', query: { householdId } }), first.res)
    const second = fakeRes()
    await handleForecast(db, fakeReq({ method: 'GET', query: { householdId } }), second.res)
    const a = (first.body() as { current: { id: string } }).current
    const b = (second.body() as { current: { id: string } }).current
    expect(a.id).toBe(b.id)
  })

  it('POST requires a non-empty note', async () => {
    const { res, status } = fakeRes()
    await handleForecast(db, fakeReq({ method: 'POST', body: { householdId, note: '  ' } }), res)
    expect(status()).toBe(400)
  })

  it('POST creates a replan, which becomes the new plan-of-record, while the original stays retrievable', async () => {
    const before = fakeRes()
    await handleForecast(db, fakeReq({ method: 'GET', query: { householdId } }), before.res)
    const originalId = (before.body() as { original: { id: string } }).original.id

    const { res, status, body } = fakeRes()
    await handleForecast(
      db,
      fakeReq({ method: 'POST', body: { householdId, note: 'bought the house' } }),
      res,
    )
    expect(status()).toBe(201)
    expect((body() as { replan: { type: string; note: string } }).replan.type).toBe('replan')
    expect((body() as { replan: { type: string; note: string } }).replan.note).toBe('bought the house')

    const after = fakeRes()
    await handleForecast(db, fakeReq({ method: 'GET', query: { householdId } }), after.res)
    const afterData = after.body() as { current: { type: string }; original: { id: string; type: string } }
    expect(afterData.current.type).toBe('replan')
    // the fork must stay visible — original baseline unchanged
    expect(afterData.original.id).toBe(originalId)
    expect(afterData.original.type).toBe('baseline')
  })
})

describe('GET self-heals a baseline stored in a pre-owner-filter shape', () => {
  let db: Db
  let cleanup: () => void
  let householdId: string

  beforeAll(async () => {
    ;({ db, cleanup } = await createMigratedTestDb())
    householdId = (await createHousehold(db)).id
    const personId = (await createPerson(db, { householdId, name: 'Sam', age: 36 })).id
    await createAccount(db, {
      householdId,
      personId,
      owner: 'person_a',
      provider: 'Aviva',
      accountType: 'pension',
      monthlyContribution: 500,
      openingBalance: 20_000,
    })
  })
  afterAll(() => cleanup())

  it('ignores an old flat-shape row instead of crashing, replacing it with a fresh baseline', async () => {
    // the exact flat shape stored before the owner-filter rework nested
    // totals under total/personA/personB/joint — see householdForecast.test.ts
    const legacyFlatState = {
      age: 36,
      targetAge: 58,
      pension: 20_000,
      stocks: 0,
      cash: 0,
      monthly: 0,
      pensionMonthly: 500,
      investedRate: 0.07,
      cashRate: 0.045,
    }
    const legacy = await insertForecastSnapshot(db, {
      householdId,
      type: 'baseline',
      householdStateJson: JSON.stringify(legacyFlatState),
    })

    const { res, status, body } = fakeRes()
    await handleForecast(db, fakeReq({ method: 'GET', query: { householdId } }), res)
    expect(status()).toBe(200)

    const data = body() as {
      ready: boolean
      current: { id: string; type: string; householdStateJson: string }
      original: { id: string; type: string }
    }
    expect(data.ready).toBe(true)
    // the legacy row is never trusted again, whether as current or original
    expect(data.current.id).not.toBe(legacy.id)
    expect(data.original.id).not.toBe(legacy.id)
    // self-healed silently — same row both ways, so no phantom "you replanned"
    expect(data.original.id).toBe(data.current.id)

    const state = JSON.parse(data.current.householdStateJson) as { total: { pension: number } }
    expect(state.total.pension).toBe(20_000)
  })
})
