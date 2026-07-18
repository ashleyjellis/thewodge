/**
 * Account snapshots — append-only. This module exposes no update or delete for
 * account_snapshots, only insert and read, matching the spec's explicit divergence
 * from the "Payd" reference implementation's upsert-by-(account, year, month)
 * pattern: a past period is never silently rewritten.
 */
import { desc, eq } from 'drizzle-orm'
import type { Db } from './client'
import { accounts, accountSnapshots } from './schema'

export type AccountSnapshot = typeof accountSnapshots.$inferSelect

export type NewAccountSnapshot = {
  accountId: string
  year: number
  month: number
  startBalance: number
  endBalance: number
  moneyIn?: number | null
  transferOut?: number | null
  isEstimated?: boolean
  note?: string | null
}

/**
 * Appends a new snapshot and syncs the account's current_balance to match. Never
 * updates a previous row — even when "catching up" several periods, the caller
 * should call this once per period, never overwrite one.
 */
export async function insertSnapshot(
  db: Db,
  input: NewAccountSnapshot,
): Promise<AccountSnapshot> {
  const row: AccountSnapshot = {
    id: crypto.randomUUID(),
    accountId: input.accountId,
    recordedAt: new Date().toISOString(),
    year: input.year,
    month: input.month,
    startBalance: input.startBalance,
    moneyIn: input.moneyIn ?? null,
    transferOut: input.transferOut ?? null,
    endBalance: input.endBalance,
    isEstimated: input.isEstimated ?? false,
    note: input.note ?? null,
  }
  await db.insert(accountSnapshots).values(row)
  await db
    .update(accounts)
    .set({ currentBalance: input.endBalance })
    .where(eq(accounts.id, input.accountId))
  return row
}

export async function listSnapshots(db: Db, accountId: string): Promise<AccountSnapshot[]> {
  const rows = await db
    .select()
    .from(accountSnapshots)
    .where(eq(accountSnapshots.accountId, accountId))
  return rows.sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month,
  )
}

export async function getLatestSnapshot(
  db: Db,
  accountId: string,
): Promise<AccountSnapshot | null> {
  const rows = await db
    .select()
    .from(accountSnapshots)
    .where(eq(accountSnapshots.accountId, accountId))
    .orderBy(desc(accountSnapshots.recordedAt))
    .limit(1)
  return rows[0] ?? null
}

export type PeriodGrowth = {
  /** null when money_in/transfer_out are missing — see periodGrowth() */
  growth: number | null
  moneyInMissing: boolean
  transferOutMissing: boolean
}

/**
 * Growth attributable to the market for one snapshot's period:
 *
 *   end_balance − start_balance − money_in + transfer_out
 *
 * NEVER a raw end − start diff — that is exactly the bug this schema exists to
 * avoid (a raw diff against a briefly-blank balance is what produced the
 * reference implementation's nonsensical −181%/−102% growth figures). If either
 * money_in or transfer_out is missing, growth is explicitly null (unavailable)
 * rather than silently treating the missing value as zero.
 */
export function periodGrowth(
  snapshot: Pick<AccountSnapshot, 'startBalance' | 'endBalance' | 'moneyIn' | 'transferOut'>,
): PeriodGrowth {
  const moneyInMissing = snapshot.moneyIn === null || snapshot.moneyIn === undefined
  const transferOutMissing =
    snapshot.transferOut === null || snapshot.transferOut === undefined
  if (moneyInMissing || transferOutMissing) {
    return { growth: null, moneyInMissing, transferOutMissing }
  }
  const growth =
    snapshot.endBalance - snapshot.startBalance - snapshot.moneyIn! + snapshot.transferOut!
  return { growth, moneyInMissing: false, transferOutMissing: false }
}

/** Whole calendar months between two (year, month) points. */
export function monthsBetween(
  from: { year: number; month: number },
  to: { year: number; month: number },
): number {
  return (to.year - from.year) * 12 + (to.month - from.month)
}

/**
 * The pre-filled estimate for a new update: money_in = monthly_contribution ×
 * months elapsed since the last snapshot, transfer_out = 0. The Growth tab (a
 * later phase) shows both as editable and labelled "estimated," never applies
 * them silently — see the spec's update-flow steps 3-4.
 */
export function estimateContribution(
  monthlyContribution: number,
  monthsElapsed: number,
): { moneyIn: number; transferOut: number } {
  return { moneyIn: monthlyContribution * Math.max(0, monthsElapsed), transferOut: 0 }
}
