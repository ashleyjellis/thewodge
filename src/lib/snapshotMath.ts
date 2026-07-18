/**
 * Client-safe mirror of the pure snapshot math in src/server/db/accountSnapshots.ts
 * — duplicated rather than imported so client code never reaches across the
 * server ring, even for pure functions (see src/state/useAccounts.ts for the
 * same pattern). Keep these two in lockstep if the formula ever changes.
 */

export type SnapshotLike = {
  year: number
  month: number
  startBalance: number
  endBalance: number
  moneyIn: number | null
  transferOut: number | null
  isEstimated: boolean
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
 * NEVER a raw end − start diff — see the server-side periodGrowth() doc for why.
 */
export function periodGrowth(
  snapshot: Pick<SnapshotLike, 'startBalance' | 'endBalance' | 'moneyIn' | 'transferOut'>,
): PeriodGrowth {
  const moneyInMissing = snapshot.moneyIn === null || snapshot.moneyIn === undefined
  const transferOutMissing = snapshot.transferOut === null || snapshot.transferOut === undefined
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
 * months elapsed since the last snapshot, transfer_out = 0. Shown as editable and
 * labelled "estimated" — never applied silently (spec §3 steps 3-4).
 */
export function estimateContribution(
  monthlyContribution: number,
  monthsElapsed: number,
): { moneyIn: number; transferOut: number } {
  return { moneyIn: monthlyContribution * Math.max(0, monthsElapsed), transferOut: 0 }
}

export type GrowthTotal = {
  /** sum of every snapshot's known growth — periods with missing data are
   *  excluded from this, never silently treated as zero */
  total: number
  /** how many snapshots had missing money_in/transfer_out and were excluded */
  missingCount: number
  hasAny: boolean
}

/** Cumulative market growth across a set of snapshots (spec §3: "true growth"). */
export function totalGrowth(snapshots: SnapshotLike[]): GrowthTotal {
  let total = 0
  let missingCount = 0
  for (const s of snapshots) {
    const g = periodGrowth(s)
    if (g.growth === null) {
      missingCount += 1
    } else {
      total += g.growth
    }
  }
  return { total, missingCount, hasAny: snapshots.length > 0 }
}

/**
 * Whether tracking has genuinely begun: at least one account has been through
 * a real update beyond its opening entry. An account with only its opening
 * snapshot hasn't been "tracked" yet in the Growth-tab sense, even though that
 * snapshot has a well-defined (zero) growth figure — this is a structural
 * check (snapshot count), not a growth-value check, precisely so it doesn't
 * depend on how an opening entry's money_in/transfer_out happen to be stored.
 */
export function hasBeenUpdated(snapshots: { accountId: string }[]): boolean {
  const counts = new Map<string, number>()
  for (const s of snapshots) {
    counts.set(s.accountId, (counts.get(s.accountId) ?? 0) + 1)
  }
  return [...counts.values()].some((count) => count >= 2)
}

/**
 * The most recent snapshot per account, keyed by account_id — ties (more than
 * one snapshot recorded in the same visit) broken by recordedAt, matching the
 * server's getLatestSnapshot(). Used for "last updated" display and as the
 * update flow's starting point for each account.
 */
export function latestSnapshotByAccount<S extends { accountId: string; recordedAt: string }>(
  snapshots: S[],
): Map<string, S> {
  const latest = new Map<string, S>()
  for (const s of snapshots) {
    const current = latest.get(s.accountId)
    if (!current || s.recordedAt > current.recordedAt) {
      latest.set(s.accountId, s)
    }
  }
  return latest
}

export type YearlyRollup = {
  year: number
  startBalance: number
  endBalance: number
  moneyIn: number | null
  transferOut: number | null
  isEstimated: boolean
}

/**
 * Rolls a chronological list of one account's snapshots up to one row per
 * calendar year, for the Growth tab's annual view (spec §3: "toggle monthly /
 * annual view"). start/end come from that year's first/last snapshot;
 * money_in/transfer_out are summed across the year (null-propagating — a
 * missing figure in any snapshot in the year makes the whole year's figure
 * unavailable, never silently treated as zero, matching periodGrowth()).
 * isEstimated is true if any snapshot in the year was an estimate.
 */
export function rollupSnapshotsByYear(snapshots: SnapshotLike[]): YearlyRollup[] {
  const sorted = [...snapshots].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month,
  )
  const byYear = new Map<number, SnapshotLike[]>()
  for (const s of sorted) {
    const list = byYear.get(s.year) ?? []
    list.push(s)
    byYear.set(s.year, list)
  }
  return [...byYear.entries()].map(([year, list]) => {
    const first = list[0]!
    const last = list[list.length - 1]!
    const moneyInMissing = list.some((s) => s.moneyIn === null)
    const transferOutMissing = list.some((s) => s.transferOut === null)
    return {
      year,
      startBalance: first.startBalance,
      endBalance: last.endBalance,
      moneyIn: moneyInMissing ? null : list.reduce((sum, s) => sum + (s.moneyIn ?? 0), 0),
      transferOut: transferOutMissing
        ? null
        : list.reduce((sum, s) => sum + (s.transferOut ?? 0), 0),
      isEstimated: list.some((s) => s.isEstimated),
    }
  })
}
