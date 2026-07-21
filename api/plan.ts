/**
 * GET    /api/plan?householdId=X → { contributionChanges, plannedEvents } for
 *        the household — the live Plan table's editable schedule, entirely
 *        separate from /api/forecast's frozen baseline/replan model.
 * POST   /api/plan → { householdId, kind: 'contribution_change' | 'planned_event', ... }
 *        creates one row of the given kind.
 * DELETE /api/plan → { id, kind } removes one row.
 */
import { getDb, type Db } from '../src/server/db/client.js'
import {
  createContributionChange,
  deleteContributionChange,
  listContributionChanges,
} from '../src/server/db/contributionChanges.js'
import { createPlannedEvent, deletePlannedEvent, listPlannedEvents } from '../src/server/db/plannedEvents.js'
import { listPeople } from '../src/server/db/people.js'
import type { AccountOwner, ContributionChangeType, PotCategory } from '../src/server/db/schema.js'
import { checkPensionAccess } from '../src/lib/pensionAccess.js'
import {
  badRequest,
  methodNotAllowed,
  parseBody,
  serverError,
  type ApiRequest,
  type ApiResponse,
} from './_lib/http.js'

const OWNERS: readonly AccountOwner[] = ['person_a', 'person_b', 'joint']
const POTS: readonly PotCategory[] = ['pension', 'investments', 'cash']
const CHANGE_TYPES: readonly ContributionChangeType[] = ['set', 'grow_pct', 'annual_bonus']

function isOwner(v: unknown): v is AccountOwner {
  return typeof v === 'string' && (OWNERS as readonly string[]).includes(v)
}
function isPotCategory(v: unknown): v is PotCategory {
  return typeof v === 'string' && (POTS as readonly string[]).includes(v)
}

export async function handlePlan(db: Db, req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    if (req.method === 'GET') {
      const householdId = req.query?.householdId
      if (typeof householdId !== 'string') return badRequest(res, 'householdId is required')
      const [contributionChanges, plannedEvents] = await Promise.all([
        listContributionChanges(db, householdId),
        listPlannedEvents(db, householdId),
      ])
      res.status(200).json({ ok: true, contributionChanges, plannedEvents })
      return
    }

    if (req.method === 'POST') {
      const body = parseBody(req)
      if (typeof body.householdId !== 'string') return badRequest(res, 'householdId is required')
      if (!isOwner(body.owner)) return badRequest(res, 'a valid owner is required')
      if (!isPotCategory(body.potCategory)) return badRequest(res, 'a valid potCategory is required')

      if (body.kind === 'contribution_change') {
        if (typeof body.effectiveYear !== 'number') return badRequest(res, 'effectiveYear is required')
        if (typeof body.changeType !== 'string' || !(CHANGE_TYPES as readonly string[]).includes(body.changeType))
          return badRequest(res, 'a valid changeType is required')
        if (typeof body.value !== 'number' || !Number.isFinite(body.value))
          return badRequest(res, 'a real value is required')

        const change = await createContributionChange(db, {
          householdId: body.householdId,
          owner: body.owner,
          potCategory: body.potCategory,
          effectiveYear: body.effectiveYear,
          changeType: body.changeType as ContributionChangeType,
          value: body.value,
          note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
        })
        res.status(201).json({ ok: true, contributionChange: change })
        return
      }

      if (body.kind === 'planned_event') {
        if (typeof body.year !== 'number') return badRequest(res, 'year is required')
        if (typeof body.name !== 'string' || !body.name.trim()) return badRequest(res, 'a name is required')
        if (typeof body.amount !== 'number' || !Number.isFinite(body.amount))
          return badRequest(res, 'a real amount is required')

        if (body.potCategory === 'pension' && body.amount < 0) {
          const people = await listPeople(db, body.householdId)
          const access = checkPensionAccess(
            { owner: body.owner, potCategory: body.potCategory, year: body.year, amount: body.amount },
            new Date().getUTCFullYear(),
            { personA: people[0] ?? null, personB: people[1] ?? null },
          )
          if (!access.allowed) return badRequest(res, access.reason)
        }

        const event = await createPlannedEvent(db, {
          householdId: body.householdId,
          owner: body.owner,
          potCategory: body.potCategory,
          year: body.year,
          name: body.name.trim(),
          amount: body.amount,
          note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
        })
        res.status(201).json({ ok: true, plannedEvent: event })
        return
      }

      return badRequest(res, "kind must be 'contribution_change' or 'planned_event'")
    }

    if (req.method === 'DELETE') {
      const body = parseBody(req)
      if (typeof body.id !== 'string') return badRequest(res, 'id is required')
      if (body.kind === 'contribution_change') {
        await deleteContributionChange(db, body.id)
        res.status(200).json({ ok: true })
        return
      }
      if (body.kind === 'planned_event') {
        await deletePlannedEvent(db, body.id)
        res.status(200).json({ ok: true })
        return
      }
      return badRequest(res, "kind must be 'contribution_change' or 'planned_event'")
    }

    methodNotAllowed(res)
  } catch (err) {
    serverError(res, err)
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    await handlePlan(getDb(), req, res)
  } catch (err) {
    serverError(res, err)
  }
}
