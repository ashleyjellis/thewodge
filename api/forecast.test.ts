import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMigratedTestDb } from '../src/server/db/testHelpers'
import { createHousehold } from '../src/server/db/households'
import { createPerson } from '../src/server/db/people'
import { createAccount } from '../src/server/db/accounts'
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
    expect(state.pension).toBe(20_000)
    expect(state.pensionMonthly).toBe(500)
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
