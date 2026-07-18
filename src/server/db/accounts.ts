/**
 * Accounts — the single source of truth for "what you hold and where." Every
 * pot-category rollup shown anywhere else in the app (Growth, Forecast) must be
 * computed by summing these rows by pot_category — see rollupByPotCategory.
 */
import { eq } from 'drizzle-orm'
import type { Db } from './client.js'
import {
  accounts,
  ACCOUNT_OWNERS,
  POT_CATEGORIES,
  type AccountOwner,
  type AccountType,
  type PotCategory,
} from './schema.js'
import {
  getLatestSnapshot,
  insertSnapshot,
  type AccountSnapshot,
} from './accountSnapshots.js'

export type Account = typeof accounts.$inferSelect

/**
 * account_type → pot_category, fixed and not user-editable (spec §0). 'other'
 * defaults to 'investments' — the Accounts tab UI (a later phase) should prompt
 * the user to classify it more specifically at creation time.
 */
export function accountTypeToPotCategory(accountType: AccountType): PotCategory {
  switch (accountType) {
    case 'pension':
      return 'pension'
    case 'cash_isa':
    case 'savings_account':
      return 'cash'
    case 'stocks_isa':
    case 'lisa':
      return 'investments'
    case 'other':
      return 'investments'
  }
}

export class AccountOwnershipError extends Error {}
export class AccountAlreadyHasBalanceError extends Error {}
export class InvalidBalanceError extends Error {}
export class AccountNotFoundError extends Error {}

async function writeOpeningBalanceSnapshot(db: Db, accountId: string, balance: number): Promise<void> {
  const opened = new Date()
  await insertSnapshot(db, {
    accountId,
    year: opened.getUTCFullYear(),
    month: opened.getUTCMonth() + 1,
    startBalance: balance,
    endBalance: balance,
    // known-zero, not unknown: there's no prior period for a contribution to
    // have happened in, so this isn't the "missing data" null means elsewhere —
    // periodGrowth() should read this as a well-defined zero, not unavailable
    moneyIn: 0,
    transferOut: 0,
    isEstimated: false,
    note: 'Opening balance',
  })
}

export type NewAccount = {
  householdId: string
  /** required unless owner === 'joint' */
  personId: string | null
  owner: AccountOwner
  provider: string
  accountType: AccountType
  isRingFenced?: boolean
  isGoalEarmarked?: boolean
  monthlyContribution?: number
  /** if given, also writes the first account_snapshots row (start = end = this figure) */
  openingBalance?: number
}

/**
 * Creates the account, with pot_category always derived (never accepted as caller
 * input — see accountTypeToPotCategory). If an opening balance is given, also
 * writes the first append-only snapshot, matching the Accounts tab's "current
 * balance creates the first account_snapshots row" behaviour (spec §2).
 */
export async function createAccount(db: Db, input: NewAccount): Promise<Account> {
  if (input.owner === 'joint' && input.personId !== null) {
    throw new AccountOwnershipError('Joint accounts must not be tied to a single person')
  }
  if (input.owner !== 'joint' && input.personId === null) {
    throw new AccountOwnershipError('Non-joint accounts must have a person')
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const row: Account = {
    id,
    householdId: input.householdId,
    personId: input.personId,
    owner: input.owner,
    provider: input.provider,
    accountType: input.accountType,
    potCategory: accountTypeToPotCategory(input.accountType),
    isRingFenced: input.isRingFenced ?? false,
    isGoalEarmarked: input.isGoalEarmarked ?? false,
    monthlyContribution: input.monthlyContribution ?? 0,
    currentBalance: input.openingBalance ?? null,
    createdAt: now,
  }

  await db.insert(accounts).values(row)

  if (input.openingBalance !== undefined) {
    await writeOpeningBalanceSnapshot(db, id, input.openingBalance)
  }

  return row
}

/**
 * Records the first balance for an account that was created without one — the
 * "I skipped it at creation" recovery path. Rejects once a balance already
 * exists: from then on, updates belong to the Growth tab's snapshot flow (a
 * later phase), never a silent overwrite here.
 */
export async function setOpeningBalance(db: Db, accountId: string, balance: number): Promise<void> {
  const account = await getAccount(db, accountId)
  if (!account) throw new AccountNotFoundError('account not found')
  if (account.currentBalance !== null) {
    throw new AccountAlreadyHasBalanceError(
      'This account already has a recorded balance — further updates belong in the Growth tab',
    )
  }
  await writeOpeningBalanceSnapshot(db, accountId, balance)
}

export type RecordUpdateInput = {
  endBalance: number
  moneyIn: number
  transferOut: number
  isEstimated: boolean
  note?: string | null
}

/**
 * The Growth tab's "update balances" save action (spec §3, steps 1-5) — one new
 * append-only snapshot for this account. start_balance is never entered
 * directly: it's the previous snapshot's end_balance, or (for an account with no
 * snapshot yet — e.g. one added without an opening balance) this same
 * end_balance, matching the opening-balance convention rather than fabricating a
 * start point from nothing.
 */
export async function recordUpdate(
  db: Db,
  accountId: string,
  input: RecordUpdateInput,
): Promise<AccountSnapshot> {
  if (!Number.isFinite(input.endBalance)) {
    throw new InvalidBalanceError('a real end balance is required')
  }
  const account = await getAccount(db, accountId)
  if (!account) throw new AccountNotFoundError('account not found')

  const latest = await getLatestSnapshot(db, accountId)
  const startBalance = latest ? latest.endBalance : input.endBalance
  const now = new Date()
  return insertSnapshot(db, {
    accountId,
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    startBalance,
    endBalance: input.endBalance,
    moneyIn: input.moneyIn,
    transferOut: input.transferOut,
    isEstimated: input.isEstimated,
    note: input.note ?? null,
  })
}

export type AccountPatch = Partial<
  Pick<
    Account,
    | 'provider'
    | 'accountType'
    | 'isRingFenced'
    | 'isGoalEarmarked'
    | 'monthlyContribution'
  >
>

/**
 * Editing accountType re-derives potCategory automatically — the two can never
 * drift. A no-op patch (e.g. a PATCH that only carries openingBalance) is a
 * valid call, not an error — Drizzle rejects an empty .set(), so guard it here.
 */
export async function updateAccount(db: Db, id: string, patch: AccountPatch): Promise<void> {
  const values: Partial<Account> = { ...patch }
  if (patch.accountType) {
    values.potCategory = accountTypeToPotCategory(patch.accountType)
  }
  if (Object.keys(values).length === 0) return
  await db.update(accounts).set(values).where(eq(accounts.id, id))
}

export async function getAccount(db: Db, id: string): Promise<Account | null> {
  const rows = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1)
  return rows[0] ?? null
}

export async function listAccounts(db: Db, householdId: string): Promise<Account[]> {
  return db.select().from(accounts).where(eq(accounts.householdId, householdId))
}

export type PotRollup = Record<PotCategory, number>

/**
 * Sums current_balance by pot_category for a household — the ONLY way pot totals
 * should be computed anywhere in the app (spec §2: "never hand-entered separately").
 * Ring-fenced cash is included here; callers that need the "investable" view
 * (excluding the emergency fund) should filter accounts by isRingFenced first.
 */
export function rollupByPotCategory(accountRows: Pick<Account, 'potCategory' | 'currentBalance'>[]): PotRollup {
  const totals: PotRollup = { pension: 0, investments: 0, cash: 0 }
  for (const a of accountRows) {
    totals[a.potCategory] += a.currentBalance ?? 0
  }
  return totals
}

export function isValidAccountOwner(value: string): value is AccountOwner {
  return ACCOUNT_OWNERS.includes(value as AccountOwner)
}

export const ALL_POT_CATEGORIES = POT_CATEGORIES
