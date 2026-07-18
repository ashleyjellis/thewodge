import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMigratedTestDb } from '../src/server/db/testHelpers'
import { createHousehold } from '../src/server/db/households'
import { createPerson } from '../src/server/db/people'
import type { Db } from '../src/server/db/client'
import { handleAccounts } from './accounts'
import { fakeReq, fakeRes } from './_lib/testHttp'

describe('accounts API', () => {
  let db: Db
  let cleanup: () => void
  let householdId: string
  let personId: string

  beforeAll(async () => {
    ;({ db, cleanup } = await createMigratedTestDb())
    householdId = (await createHousehold(db)).id
    personId = (await createPerson(db, { householdId, name: 'Sam', age: 36 })).id
  })
  afterAll(() => cleanup())

  it('GET requires a householdId', async () => {
    const { res, status } = fakeRes()
    await handleAccounts(db, fakeReq({ method: 'GET' }), res)
    expect(status()).toBe(400)
  })

  it('GET returns an empty list before anything is created', async () => {
    const { res, status, body } = fakeRes()
    await handleAccounts(db, fakeReq({ method: 'GET', query: { householdId } }), res)
    expect(status()).toBe(200)
    expect((body() as { accounts: unknown[] }).accounts).toEqual([])
  })

  it('POST creates an account and derives pot_category — never accepts it as input', async () => {
    const { res, status, body } = fakeRes()
    await handleAccounts(
      db,
      fakeReq({
        method: 'POST',
        body: {
          householdId,
          personId,
          owner: 'person_a',
          provider: 'HL',
          accountType: 'stocks_isa',
          monthlyContribution: 300,
          openingBalance: 60_000,
          // deliberately trying to smuggle a pot_category in — must be ignored
          potCategory: 'cash',
        },
      }),
      res,
    )
    expect(status()).toBe(201)
    const b = body() as { account: { potCategory: string; currentBalance: number } }
    expect(b.account.potCategory).toBe('investments') // derived, not 'cash'
    expect(b.account.currentBalance).toBe(60_000)
  })

  it('POST rejects an invalid owner', async () => {
    const { res, status } = fakeRes()
    await handleAccounts(
      db,
      fakeReq({
        method: 'POST',
        body: {
          householdId,
          personId,
          owner: 'person_c',
          provider: 'HL',
          accountType: 'stocks_isa',
        },
      }),
      res,
    )
    expect(status()).toBe(400)
  })

  it('POST rejects a joint account tied to a person', async () => {
    const { res, status, body } = fakeRes()
    await handleAccounts(
      db,
      fakeReq({
        method: 'POST',
        body: { householdId, personId, owner: 'joint', provider: 'Chase', accountType: 'savings_account' },
      }),
      res,
    )
    expect(status()).toBe(400)
    expect((body() as { error: string }).error).toBeTruthy()
  })

  it('GET now lists the created account', async () => {
    const { res, body } = fakeRes()
    await handleAccounts(db, fakeReq({ method: 'GET', query: { householdId } }), res)
    const accounts = (body() as { accounts: { provider: string }[] }).accounts
    expect(accounts.some((a) => a.provider === 'HL')).toBe(true)
  })

  it('PATCH updates and re-derives pot_category when account_type changes', async () => {
    const listRes = fakeRes()
    await handleAccounts(db, fakeReq({ method: 'GET', query: { householdId } }), listRes.res)
    const account = (listRes.body() as { accounts: { id: string }[] }).accounts[0]!

    const { res, status } = fakeRes()
    await handleAccounts(
      db,
      fakeReq({ method: 'PATCH', body: { id: account.id, accountType: 'pension' } }),
      res,
    )
    expect(status()).toBe(200)

    const reGet = fakeRes()
    await handleAccounts(db, fakeReq({ method: 'GET', query: { householdId } }), reGet.res)
    const updated = (reGet.body() as { accounts: { id: string; potCategory: string }[] }).accounts.find(
      (a) => a.id === account.id,
    )
    expect(updated!.potCategory).toBe('pension')
  })
})
