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
import { insertSnapshot } from './accountSnapshots.js'

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
    const opened = new Date(now)
    await insertSnapshot(db, {
      accountId: id,
      year: opened.getUTCFullYear(),
      month: opened.getUTCMonth() + 1,
      startBalance: input.openingBalance,
      endBalance: input.openingBalance,
      moneyIn: null,
      transferOut: null,
      isEstimated: false,
      note: 'Opening balance',
    })
  }

  return row
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

/** Editing accountType re-derives potCategory automatically — the two can never drift. */
export async function updateAccount(db: Db, id: string, patch: AccountPatch): Promise<void> {
  const values: Partial<Account> = { ...patch }
  if (patch.accountType) {
    values.potCategory = accountTypeToPotCategory(patch.accountType)
  }
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
