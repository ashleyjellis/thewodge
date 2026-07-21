import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMigratedTestDb } from '../src/server/db/testHelpers'
import { createHousehold } from '../src/server/db/households'
import { createPerson } from '../src/server/db/people'
import type { Db } from '../src/server/db/client'
import { handleSalaryChanges } from './salaryChanges'
import { fakeReq, fakeRes } from './_lib/testHttp'

describe('salaryChanges API', () => {
  let db: Db
  let cleanup: () => void
  let householdId: string
  let personId: string

  beforeAll(async () => {
    ;({ db, cleanup } = await createMigratedTestDb())
    householdId = (await createHousehold(db)).id
    personId = (await createPerson(db, { householdId, name: 'Ashley', age: 31, salary: 93_500 })).id
  })
  afterAll(() => cleanup())

  it('GET requires a householdId', async () => {
    const { res, status } = fakeRes()
    await handleSalaryChanges(db, fakeReq({ method: 'GET' }), res)
    expect(status()).toBe(400)
  })

  it('GET returns an empty list before anything is logged', async () => {
    const { res, status, body } = fakeRes()
    await handleSalaryChanges(db, fakeReq({ method: 'GET', query: { householdId } }), res)
    expect(status()).toBe(200)
    expect((body() as { salaryChanges: unknown[] }).salaryChanges).toEqual([])
  })

  it('POST logs an actual salary for a person', async () => {
    const { res, status, body } = fakeRes()
    await handleSalaryChanges(
      db,
      fakeReq({ method: 'POST', body: { personId, effectiveYear: 2027, salary: 96_305 } }),
      res,
    )
    expect(status()).toBe(201)
    const change = (body() as { salaryChange: { personId: string; effectiveYear: number; salary: number } })
      .salaryChange
    expect(change.personId).toBe(personId)
    expect(change.effectiveYear).toBe(2027)
    expect(change.salary).toBe(96_305)
  })

  it('GET reflects a logged change afterwards', async () => {
    const { res, body } = fakeRes()
    await handleSalaryChanges(db, fakeReq({ method: 'GET', query: { householdId } }), res)
    expect((body() as { salaryChanges: unknown[] }).salaryChanges).toHaveLength(1)
  })

  it('POST rejects a missing personId', async () => {
    const { res, status } = fakeRes()
    await handleSalaryChanges(db, fakeReq({ method: 'POST', body: { effectiveYear: 2027, salary: 1 } }), res)
    expect(status()).toBe(400)
  })

  it('POST rejects a negative salary', async () => {
    const { res, status } = fakeRes()
    await handleSalaryChanges(
      db,
      fakeReq({ method: 'POST', body: { personId, effectiveYear: 2027, salary: -1 } }),
      res,
    )
    expect(status()).toBe(400)
  })

  it('rejects an unsupported method', async () => {
    const { res, status } = fakeRes()
    await handleSalaryChanges(db, fakeReq({ method: 'DELETE' }), res)
    expect(status()).toBe(405)
  })
})
