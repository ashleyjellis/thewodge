/**
 * GET  /api/forecast?householdId=X → the plan-of-record + original baseline,
 *      auto-creating a baseline from live state on first-ever visit (spec §4)
 *      if enough is set up to forecast. Returns { ready: false } when there
 *      isn't yet (no people, or no accounts).
 * POST /api/forecast               → { householdId, note } creates a replan
 *      from live state — always explicit, never automatic (spec §4).
 */
import { getDb, type Db } from '../src/server/db/client.js'
import { getOrCreateHousehold } from '../src/server/db/households.js'
import { listPeople } from '../src/server/db/people.js'
import { listAccounts } from '../src/server/db/accounts.js'
import {
  createBaseline,
  createReplan,
  listForecastSnapshots,
  type ForecastSnapshot,
} from '../src/server/db/forecastSnapshots.js'
import { aggregateHouseholdState, canForecast, isValidFrozenState } from '../src/lib/householdForecast.js'
import {
  badRequest,
  methodNotAllowed,
  parseBody,
  serverError,
  type ApiRequest,
  type ApiResponse,
} from './_lib/http.js'

/**
 * A snapshot's householdStateJson can predate a shape change (e.g. the
 * owner-filter rework that nested totals under total/personA/personB/joint) —
 * old rows are never migrated, they're just never trusted again.
 */
function isStoredStateValid(householdStateJson: string): boolean {
  try {
    return isValidFrozenState(JSON.parse(householdStateJson))
  } catch {
    return false
  }
}

export async function handleForecast(db: Db, req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    if (req.method === 'GET') {
      const householdId = req.query?.householdId
      if (typeof householdId !== 'string') return badRequest(res, 'householdId is required')

      const household = await getOrCreateHousehold(db)
      const people = await listPeople(db, householdId)
      const accounts = await listAccounts(db, householdId)

      if (!canForecast(people, accounts)) {
        res.status(200).json({ ok: true, ready: false })
        return
      }

      // ignore any row whose JSON predates the current FrozenForecastState
      // shape — treated the same as if it were never recorded, never trusted
      // just because it happens to parse
      const validSnapshots = (await listForecastSnapshots(db, householdId)).filter((s) =>
        isStoredStateValid(s.householdStateJson),
      )

      let current: ForecastSnapshot | null = validSnapshots.at(-1) ?? null
      if (!current) {
        const state = aggregateHouseholdState(household, people, accounts)
        current = await createBaseline(db, householdId, JSON.stringify(state))
      }
      const original = validSnapshots.find((s) => s.type === 'baseline') ?? current

      res.status(200).json({ ok: true, ready: true, current, original })
      return
    }

    if (req.method === 'POST') {
      const body = parseBody(req)
      if (typeof body.householdId !== 'string') return badRequest(res, 'householdId is required')
      if (typeof body.note !== 'string' || !body.note.trim())
        return badRequest(res, 'a short note is required to replan')

      const household = await getOrCreateHousehold(db)
      const people = await listPeople(db, body.householdId)
      const accounts = await listAccounts(db, body.householdId)
      if (!canForecast(people, accounts)) return badRequest(res, 'not enough set up to replan yet')

      const state = aggregateHouseholdState(household, people, accounts)
      const replan = await createReplan(db, body.householdId, JSON.stringify(state), body.note)
      res.status(201).json({ ok: true, replan })
      return
    }

    methodNotAllowed(res)
  } catch (err) {
    serverError(res, err)
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    await handleForecast(getDb(), req, res)
  } catch (err) {
    serverError(res, err)
  }
}
