/**
 * GET  /api/household  → { household, people } — bootstraps the Accounts tab.
 * PATCH /api/household → { id, ...patch } updates household-level assumptions.
 *
 * v1 has no auth: getOrCreateHousehold always resolves to "the" one household
 * (see src/server/db/households.ts). Exported as a testable core function plus a
 * thin default export, so tests can inject a db instance without hitting Turso.
 */
import { getDb, type Db } from '../src/server/db/client.js'
import { getOrCreateHousehold, updateHousehold, type HouseholdPatch } from '../src/server/db/households.js'
import { listPeople } from '../src/server/db/people.js'
import {
  badRequest,
  methodNotAllowed,
  parseBody,
  serverError,
  type ApiRequest,
  type ApiResponse,
} from './_lib/http.js'

export async function handleHousehold(
  db: Db,
  req: ApiRequest,
  res: ApiResponse,
): Promise<void> {
  try {
    if (req.method === 'GET') {
      const household = await getOrCreateHousehold(db)
      const people = await listPeople(db, household.id)
      res.status(200).json({ ok: true, household, people })
      return
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req)
      if (typeof body.id !== 'string') return badRequest(res, 'id is required')

      const patch: HouseholdPatch = {}
      if (typeof body.retirementAge === 'number') patch.retirementAge = body.retirementAge
      if (typeof body.targetIncomeToday === 'number')
        patch.targetIncomeToday = body.targetIncomeToday
      if (typeof body.realReturn === 'number') patch.realReturn = body.realReturn
      if (typeof body.cashReturn === 'number') patch.cashReturn = body.cashReturn
      if (typeof body.swr === 'number') patch.swr = body.swr

      await updateHousehold(db, body.id, patch)
      res.status(200).json({ ok: true })
      return
    }

    methodNotAllowed(res)
  } catch (err) {
    serverError(res, err)
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    await handleHousehold(getDb(), req, res)
  } catch (err) {
    serverError(res, err)
  }
}
