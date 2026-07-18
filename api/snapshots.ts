/**
 * GET  /api/snapshots?householdId=X → every snapshot across every account in the
 *      household (the Growth tab's history/diary and rollups all read from this).
 * POST /api/snapshots               → record one account's balance update
 *      (spec §3 steps 1-5). Never accepts start_balance or pot_category — the
 *      server derives start_balance from the previous snapshot, same guarantee
 *      as pot_category on the accounts endpoint.
 */
import { getDb, type Db } from '../src/server/db/client.js'
import {
  AccountNotFoundError,
  InvalidBalanceError,
  recordUpdate,
} from '../src/server/db/accounts.js'
import { listSnapshotsForHousehold } from '../src/server/db/accountSnapshots.js'
import {
  badRequest,
  methodNotAllowed,
  parseBody,
  serverError,
  type ApiRequest,
  type ApiResponse,
} from './_lib/http.js'

export async function handleSnapshots(db: Db, req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    if (req.method === 'GET') {
      const householdId = req.query?.householdId
      if (typeof householdId !== 'string') return badRequest(res, 'householdId is required')
      const snapshots = await listSnapshotsForHousehold(db, householdId)
      res.status(200).json({ ok: true, snapshots })
      return
    }

    if (req.method === 'POST') {
      const body = parseBody(req)
      if (typeof body.accountId !== 'string') return badRequest(res, 'accountId is required')
      if (typeof body.endBalance !== 'number' || !Number.isFinite(body.endBalance))
        return badRequest(res, 'a real endBalance is required')
      if (typeof body.moneyIn !== 'number' || !Number.isFinite(body.moneyIn))
        return badRequest(res, 'a real moneyIn is required')
      if (typeof body.transferOut !== 'number' || !Number.isFinite(body.transferOut))
        return badRequest(res, 'a real transferOut is required')
      if (typeof body.isEstimated !== 'boolean')
        return badRequest(res, 'isEstimated is required')

      const snapshot = await recordUpdate(db, body.accountId, {
        endBalance: body.endBalance,
        moneyIn: body.moneyIn,
        transferOut: body.transferOut,
        isEstimated: body.isEstimated,
        note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
      })
      res.status(201).json({ ok: true, snapshot })
      return
    }

    methodNotAllowed(res)
  } catch (err) {
    if (err instanceof InvalidBalanceError) return badRequest(res, err.message)
    if (err instanceof AccountNotFoundError) return badRequest(res, err.message)
    serverError(res, err)
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    await handleSnapshots(getDb(), req, res)
  } catch (err) {
    serverError(res, err)
  }
}
