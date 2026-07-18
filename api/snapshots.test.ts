import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMigratedTestDb } from '../src/server/db/testHelpers'
import { createHousehold } from '../src/server/db/households'
import { createPerson } from '../src/server/db/people'
import { createAccount } from '../src/server/db/accounts'
import type { Db } from '../src/server/db/client'
import { handleSnapshots } from './snapshots'
import { fakeReq, fakeRes } from './_lib/testHttp'

describe('snapshots API', () => {
  let db: Db
  let cleanup: () => void
  let householdId: string
  let personId: string
  let accountId: string

  beforeAll(async () => {
    ;({ db, cleanup } = await createMigratedTestDb())
    householdId = (await createHousehold(db)).id
    personId = (await createPerson(db, { householdId, name: 'Sam', age: 36 })).id
    accountId = (
      await createAccount(db, {
        householdId,
        personId,
        owner: 'person_a',
        provider: 'HL',
        accountType: 'stocks_isa',
        monthlyContribution: 300,
        openingBalance: 60_000,
      })
    ).id
  })
  afterAll(() => cleanup())

  it('GET requires a householdId', async () => {
    const { res, status } = fakeRes()
    await handleSnapshots(db, fakeReq({ method: 'GET' }), res)
    expect(status()).toBe(400)
  })

  it('GET returns the opening snapshot written when the account was created', async () => {
    const { res, status, body } = fakeRes()
    await handleSnapshots(db, fakeReq({ method: 'GET', query: { householdId } }), res)
    expect(status()).toBe(200)
    const snapshots = (body() as { snapshots: { accountId: string }[] }).snapshots
    expect(snapshots.some((s) => s.accountId === accountId)).toBe(true)
  })

  it('POST requires accountId, endBalance, moneyIn, transferOut, isEstimated', async () => {
    const { res, status } = fakeRes()
    await handleSnapshots(db, fakeReq({ method: 'POST', body: {} }), res)
    expect(status()).toBe(400)
  })

  it('POST rejects a non-finite endBalance rather than defaulting it', async () => {
    const { res, status } = fakeRes()
    await handleSnapshots(
      db,
      fakeReq({
        method: 'POST',
        body: { accountId, endBalance: 'sixty thousand', moneyIn: 300, transferOut: 0, isEstimated: false },
      }),
      res,
    )
    expect(status()).toBe(400)
  })

  it('POST records an update, deriving start_balance from the previous snapshot — never accepted as input', async () => {
    const { res, status, body } = fakeRes()
    await handleSnapshots(
      db,
      fakeReq({
        method: 'POST',
        body: {
          accountId,
          endBalance: 61_200,
          moneyIn: 300,
          transferOut: 0,
          isEstimated: true,
          // deliberately trying to smuggle a start_balance in — must be ignored
          startBalance: 999_999,
        },
      }),
      res,
    )
    expect(status()).toBe(201)
    const snap = (body() as { snapshot: { startBalance: number; endBalance: number; isEstimated: boolean } }).snapshot
    expect(snap.startBalance).toBe(60_000) // from the opening snapshot, not the smuggled value
    expect(snap.endBalance).toBe(61_200)
    expect(snap.isEstimated).toBe(true)
  })

  it('POST rejects an unknown accountId', async () => {
    const { res, status, body } = fakeRes()
    await handleSnapshots(
      db,
      fakeReq({
        method: 'POST',
        body: { accountId: 'does-not-exist', endBalance: 100, moneyIn: 0, transferOut: 0, isEstimated: false },
      }),
      res,
    )
    expect(status()).toBe(400)
    expect((body() as { error: string }).error).toBeTruthy()
  })

  it('GET now reflects the newly recorded snapshot alongside the opening one', async () => {
    const { res, body } = fakeRes()
    await handleSnapshots(db, fakeReq({ method: 'GET', query: { householdId } }), res)
    const snapshots = (body() as { snapshots: { accountId: string; endBalance: number }[] }).snapshots
    const forAccount = snapshots.filter((s) => s.accountId === accountId)
    expect(forAccount).toHaveLength(2)
  })
})
