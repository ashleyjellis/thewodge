/**
 * GET   /api/accounts?householdId=X → list accounts for a household.
 * POST  /api/accounts               → create an account (see NewAccount).
 * PATCH /api/accounts               → { id, ...patch } update an account.
 *
 * pot_category is never accepted here — accountTypeToPotCategory() derives it,
 * same guarantee as the data-access layer itself.
 */
import { getDb, type Db } from '../src/server/db/client.js'
import {
  AccountAlreadyHasBalanceError,
  AccountOwnershipError,
  createAccount,
  isValidAccountOwner,
  listAccounts,
  setOpeningBalance,
  updateAccount,
  type AccountPatch,
  type NewAccount,
} from '../src/server/db/accounts.js'
import { ACCOUNT_TYPES, type AccountType } from '../src/server/db/schema.js'
import {
  badRequest,
  methodNotAllowed,
  parseBody,
  serverError,
  type ApiRequest,
  type ApiResponse,
} from './_lib/http.js'

function isAccountType(v: unknown): v is AccountType {
  return typeof v === 'string' && (ACCOUNT_TYPES as readonly string[]).includes(v)
}

export async function handleAccounts(db: Db, req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    if (req.method === 'GET') {
      const householdId = req.query?.householdId
      if (typeof householdId !== 'string') return badRequest(res, 'householdId is required')
      const accounts = await listAccounts(db, householdId)
      res.status(200).json({ ok: true, accounts })
      return
    }

    if (req.method === 'POST') {
      const body = parseBody(req)
      if (typeof body.householdId !== 'string')
        return badRequest(res, 'householdId is required')
      if (typeof body.owner !== 'string' || !isValidAccountOwner(body.owner))
        return badRequest(res, 'a valid owner is required')
      if (!isAccountType(body.accountType))
        return badRequest(res, 'a valid accountType is required')
      if (typeof body.provider !== 'string' || !body.provider.trim())
        return badRequest(res, 'provider is required')

      const input: NewAccount = {
        householdId: body.householdId,
        personId: typeof body.personId === 'string' ? body.personId : null,
        owner: body.owner,
        provider: body.provider.trim(),
        accountType: body.accountType,
        isRingFenced: body.isRingFenced === true,
        isGoalEarmarked: body.isGoalEarmarked === true,
        monthlyContribution:
          typeof body.monthlyContribution === 'number' ? body.monthlyContribution : 0,
        openingBalance:
          typeof body.openingBalance === 'number' ? body.openingBalance : undefined,
      }
      const account = await createAccount(db, input)
      res.status(201).json({ ok: true, account })
      return
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req)
      if (typeof body.id !== 'string') return badRequest(res, 'id is required')

      const patch: AccountPatch = {}
      if (typeof body.provider === 'string') patch.provider = body.provider.trim()
      if (isAccountType(body.accountType)) patch.accountType = body.accountType
      if (typeof body.isRingFenced === 'boolean') patch.isRingFenced = body.isRingFenced
      if (typeof body.isGoalEarmarked === 'boolean') patch.isGoalEarmarked = body.isGoalEarmarked
      if (typeof body.monthlyContribution === 'number')
        patch.monthlyContribution = body.monthlyContribution

      await updateAccount(db, body.id, patch)
      if (typeof body.openingBalance === 'number') {
        await setOpeningBalance(db, body.id, body.openingBalance)
      }
      res.status(200).json({ ok: true })
      return
    }

    methodNotAllowed(res)
  } catch (err) {
    if (err instanceof AccountOwnershipError) return badRequest(res, err.message)
    if (err instanceof AccountAlreadyHasBalanceError) return badRequest(res, err.message)
    serverError(res, err)
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    await handleAccounts(getDb(), req, res)
  } catch (err) {
    serverError(res, err)
  }
}
