import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMigratedTestDb } from '../src/server/db/testHelpers'
import { createHousehold } from '../src/server/db/households'
import type { Db } from '../src/server/db/client'
import { handlePlan } from './plan'
import { fakeReq, fakeRes } from './_lib/testHttp'

describe('plan API', () => {
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
    await handlePlan(db, fakeReq({ method: 'GET' }), res)
    expect(status()).toBe(400)
  })

  it('GET returns empty lists before anything is created', async () => {
    const { res, status, body } = fakeRes()
    await handlePlan(db, fakeReq({ method: 'GET', query: { householdId } }), res)
    expect(status()).toBe(200)
    const b = body() as { contributionChanges: unknown[]; plannedEvents: unknown[] }
    expect(b.contributionChanges).toEqual([])
    expect(b.plannedEvents).toEqual([])
  })

  let changeId: string

  it('POST creates a contribution change', async () => {
    const { res, status, body } = fakeRes()
    await handlePlan(
      db,
      fakeReq({
        method: 'POST',
        body: {
          householdId,
          kind: 'contribution_change',
          owner: 'person_a',
          potCategory: 'investments',
          effectiveYear: 2028,
          changeType: 'set',
          value: 600,
          note: 'student finance ends',
        },
      }),
      res,
    )
    expect(status()).toBe(201)
    const change = (body() as { contributionChange: { id: string; effectiveYear: number; value: number } })
      .contributionChange
    expect(change.effectiveYear).toBe(2028)
    expect(change.value).toBe(600)
    changeId = change.id
  })

  it('POST rejects an unknown owner', async () => {
    const { res, status } = fakeRes()
    await handlePlan(
      db,
      fakeReq({
        method: 'POST',
        body: {
          householdId,
          kind: 'contribution_change',
          owner: 'not_a_real_owner',
          potCategory: 'investments',
          effectiveYear: 2028,
          changeType: 'set',
          value: 600,
        },
      }),
      res,
    )
    expect(status()).toBe(400)
  })

  it('POST rejects an unknown kind', async () => {
    const { res, status } = fakeRes()
    await handlePlan(
      db,
      fakeReq({
        method: 'POST',
        body: {
          householdId,
          kind: 'something_else',
          owner: 'person_a',
          potCategory: 'investments',
        },
      }),
      res,
    )
    expect(status()).toBe(400)
  })

  it('GET now includes the created change', async () => {
    const { res, body } = fakeRes()
    await handlePlan(db, fakeReq({ method: 'GET', query: { householdId } }), res)
    const b = body() as { contributionChanges: { id: string }[] }
    expect(b.contributionChanges.some((c) => c.id === changeId)).toBe(true)
  })

  let eventId: string

  it('POST creates a planned event', async () => {
    const { res, status, body } = fakeRes()
    await handlePlan(
      db,
      fakeReq({
        method: 'POST',
        body: {
          householdId,
          kind: 'planned_event',
          owner: 'joint',
          potCategory: 'cash',
          year: 2029,
          name: 'House deposit',
          amount: -20_000,
        },
      }),
      res,
    )
    expect(status()).toBe(201)
    const event = (body() as { plannedEvent: { id: string; name: string; amount: number } }).plannedEvent
    expect(event.name).toBe('House deposit')
    expect(event.amount).toBe(-20_000)
    eventId = event.id
  })

  it('POST rejects a planned event with no name', async () => {
    const { res, status } = fakeRes()
    await handlePlan(
      db,
      fakeReq({
        method: 'POST',
        body: {
          householdId,
          kind: 'planned_event',
          owner: 'joint',
          potCategory: 'cash',
          year: 2029,
          name: '  ',
          amount: 1_000,
        },
      }),
      res,
    )
    expect(status()).toBe(400)
  })

  it('DELETE removes a contribution change', async () => {
    const { res, status } = fakeRes()
    await handlePlan(db, fakeReq({ method: 'DELETE', body: { id: changeId, kind: 'contribution_change' } }), res)
    expect(status()).toBe(200)

    const after = fakeRes()
    await handlePlan(db, fakeReq({ method: 'GET', query: { householdId } }), after.res)
    const b = after.body() as { contributionChanges: { id: string }[] }
    expect(b.contributionChanges.some((c) => c.id === changeId)).toBe(false)
  })

  it('DELETE removes a planned event', async () => {
    const { res, status } = fakeRes()
    await handlePlan(db, fakeReq({ method: 'DELETE', body: { id: eventId, kind: 'planned_event' } }), res)
    expect(status()).toBe(200)

    const after = fakeRes()
    await handlePlan(db, fakeReq({ method: 'GET', query: { householdId } }), after.res)
    const b = after.body() as { plannedEvents: { id: string }[] }
    expect(b.plannedEvents.some((e) => e.id === eventId)).toBe(false)
  })

  it('returns 405 for unsupported methods', async () => {
    const { res, status } = fakeRes()
    await handlePlan(db, fakeReq({ method: 'PATCH' }), res)
    expect(status()).toBe(405)
  })
})
