/**
 * GET  /api/salaryChanges?householdId=X → every salary change across every
 *      person in the household (salary as an evolving input — see
 *      src/lib/salary.ts).
 * POST /api/salaryChanges               → { personId, effectiveYear, salary }
 *      logs an actual salary for a person, superseding the assumed growth
 *      rate from that year onward. Append-only, same reasoning as
 *      /api/snapshots.
 */
import { getDb, type Db } from '../src/server/db/client.js'
import { insertSalaryChange, listSalaryChangesForHousehold } from '../src/server/db/salaryChanges.js'
import {
  badRequest,
  methodNotAllowed,
  parseBody,
  serverError,
  type ApiRequest,
  type ApiResponse,
} from './_lib/http.js'

export async function handleSalaryChanges(db: Db, req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    if (req.method === 'GET') {
      const householdId = req.query?.householdId
      if (typeof householdId !== 'string') return badRequest(res, 'householdId is required')
      const changes = await listSalaryChangesForHousehold(db, householdId)
      res.status(200).json({ ok: true, salaryChanges: changes })
      return
    }

    if (req.method === 'POST') {
      const body = parseBody(req)
      if (typeof body.personId !== 'string') return badRequest(res, 'personId is required')
      if (typeof body.effectiveYear !== 'number') return badRequest(res, 'effectiveYear is required')
      if (typeof body.salary !== 'number' || !Number.isFinite(body.salary) || body.salary < 0)
        return badRequest(res, 'a real, non-negative salary is required')

      const change = await insertSalaryChange(db, {
        personId: body.personId,
        effectiveYear: body.effectiveYear,
        salary: body.salary,
        note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
      })
      res.status(201).json({ ok: true, salaryChange: change })
      return
    }

    methodNotAllowed(res)
  } catch (err) {
    serverError(res, err)
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    await handleSalaryChanges(getDb(), req, res)
  } catch (err) {
    serverError(res, err)
  }
}
