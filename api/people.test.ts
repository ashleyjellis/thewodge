import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMigratedTestDb } from '../src/server/db/testHelpers'
import { createHousehold } from '../src/server/db/households'
import type { Db } from '../src/server/db/client'
import { handlePeople } from './people'
import { fakeReq, fakeRes } from './_lib/testHttp'

describe('POST /api/people', () => {
  let db: Db
  let cleanup: () => void
  let householdId: string

  beforeAll(async () => {
    ;({ db, cleanup } = await createMigratedTestDb())
    householdId = (await createHousehold(db)).id
  })
  afterAll(() => cleanup())

  it('creates a person', async () => {
    const { res, status, body } = fakeRes()
    await handlePeople(
      db,
      fakeReq({ method: 'POST', body: { householdId, name: 'Sam', age: 36, salary: 88_000 } }),
      res,
    )
    expect(status()).toBe(201)
    const b = body() as { ok: boolean; person: { name: string; salary: number } }
    expect(b.ok).toBe(true)
    expect(b.person.name).toBe('Sam')
    expect(b.person.salary).toBe(88_000)
  })

  it('rejects a missing name', async () => {
    const { res, status } = fakeRes()
    await handlePeople(db, fakeReq({ method: 'POST', body: { householdId, age: 30 } }), res)
    expect(status()).toBe(400)
  })

  it('rejects a third person for the same household', async () => {
    await handlePeople(
      db,
      fakeReq({ method: 'POST', body: { householdId, name: 'Alex', age: 34 } }),
      fakeRes().res,
    )
    const { res, status, body } = fakeRes()
    await handlePeople(
      db,
      fakeReq({ method: 'POST', body: { householdId, name: 'Jo', age: 40 } }),
      res,
    )
    expect(status()).toBe(400)
    expect((body() as { error: string }).error).toMatch(/at most 2/i)
  })
})

describe('PATCH /api/people', () => {
  let db: Db
  let cleanup: () => void
  let householdId: string
  let personId: string

  beforeAll(async () => {
    ;({ db, cleanup } = await createMigratedTestDb())
    householdId = (await createHousehold(db)).id
    const createRes = fakeRes()
    await handlePeople(
      db,
      fakeReq({ method: 'POST', body: { householdId, name: 'Sam', age: 36, salary: 80_000 } }),
      createRes.res,
    )
    personId = (createRes.body() as { person: { id: string } }).person.id
  })
  afterAll(() => cleanup())

  it('updates only the given fields', async () => {
    const { res, status } = fakeRes()
    await handlePeople(db, fakeReq({ method: 'PATCH', body: { id: personId, age: 37 } }), res)
    expect(status()).toBe(200)
  })
})
