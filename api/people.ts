/**
 * POST  /api/people  → create a person (rejects a 3rd — see HouseholdFullError).
 * PATCH /api/people  → { id, ...patch } update a person.
 */
import { getDb, type Db } from '../src/server/db/client.js'
import {
  createPerson,
  HouseholdFullError,
  updatePerson,
  type NewPerson,
  type PersonPatch,
} from '../src/server/db/people.js'
import {
  badRequest,
  methodNotAllowed,
  parseBody,
  serverError,
  type ApiRequest,
  type ApiResponse,
} from './_lib/http.js'

function numberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export async function handlePeople(db: Db, req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    if (req.method === 'POST') {
      const body = parseBody(req)
      if (typeof body.householdId !== 'string')
        return badRequest(res, 'householdId is required')
      if (typeof body.name !== 'string' || !body.name.trim())
        return badRequest(res, 'name is required')
      if (typeof body.age !== 'number') return badRequest(res, 'age is required')

      const input: NewPerson = {
        householdId: body.householdId,
        name: body.name.trim(),
        age: body.age,
        salary: numberOrNull(body.salary),
        bonus: numberOrNull(body.bonus),
        employerPensionUserPct: numberOrNull(body.employerPensionUserPct),
        employerPensionMatchPct: numberOrNull(body.employerPensionMatchPct),
        employerPensionAdditionalPct: numberOrNull(body.employerPensionAdditionalPct),
      }
      const person = await createPerson(db, input)
      res.status(201).json({ ok: true, person })
      return
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req)
      if (typeof body.id !== 'string') return badRequest(res, 'id is required')

      const patch: PersonPatch = {}
      if (typeof body.name === 'string') patch.name = body.name.trim()
      if (typeof body.age === 'number') patch.age = body.age
      if ('salary' in body) patch.salary = numberOrNull(body.salary)
      if ('bonus' in body) patch.bonus = numberOrNull(body.bonus)
      if ('employerPensionUserPct' in body)
        patch.employerPensionUserPct = numberOrNull(body.employerPensionUserPct)
      if ('employerPensionMatchPct' in body)
        patch.employerPensionMatchPct = numberOrNull(body.employerPensionMatchPct)
      if ('employerPensionAdditionalPct' in body)
        patch.employerPensionAdditionalPct = numberOrNull(body.employerPensionAdditionalPct)

      await updatePerson(db, body.id, patch)
      res.status(200).json({ ok: true })
      return
    }

    methodNotAllowed(res)
  } catch (err) {
    if (err instanceof HouseholdFullError) return badRequest(res, err.message)
    serverError(res, err)
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    await handlePeople(getDb(), req, res)
  } catch (err) {
    serverError(res, err)
  }
}
