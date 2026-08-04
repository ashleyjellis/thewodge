/**
 * Finds where an N-year down-run should sit to produce the worst (and, for
 * contrast, the best) ending value — a deterministic search over every
 * feasible integer start-year, not a Monte Carlo distribution. This app's
 * whole ethos is "actual formula, actual numbers" (see /methodology); a
 * stochastic distribution has no single clean figure for a "how we worked
 * this out" drawer. A few dozen cheap projections for a typical horizon.
 *
 * Deliberately generic — this file knows nothing about scheduledPlan.ts or
 * projections; a caller (planBand.ts) supplies `scoreStartYear` and reads
 * back whichever placement scored worst/best. Keeps the search algorithm
 * testable on its own, with a trivial synthetic scoring function.
 */
import type { PotCategory } from './householdForecast.js'

export type DownYearPlacement = {
  startYear: number
  endValue: number
}

/**
 * Scores every feasible down-run placement — a run of `count` consecutive
 * years, entirely within [earliestYear, latestYear] — via `scoreStartYear`,
 * returning the worst- and best-scoring placement. Null when count <= 0 or
 * no placement fits the horizon; the caller collapses to "no band" then.
 */
export function findDownYearPlacements(params: {
  count: number
  earliestYear: number
  latestYear: number
  scoreStartYear: (startYear: number) => number
}): { worst: DownYearPlacement; best: DownYearPlacement } | null {
  if (params.count <= 0) return null
  const lastFeasibleStart = params.latestYear - params.count + 1
  if (lastFeasibleStart < params.earliestYear) return null

  let worst: DownYearPlacement | null = null
  let best: DownYearPlacement | null = null
  for (let startYear = params.earliestYear; startYear <= lastFeasibleStart; startYear++) {
    const endValue = params.scoreStartYear(startYear)
    if (!worst || endValue < worst.endValue) worst = { startYear, endValue }
    if (!best || endValue > best.endValue) best = { startYear, endValue }
  }
  return worst && best ? { worst, best } : null
}

/**
 * Builds the rateOverrides (scheduledPlan.ts) for a down-run of `count`
 * years starting at `startYear`, all years at `rate` — pension and
 * investments only, never cash (matches the "down-market" framing).
 */
export function downYearRateOverrides(
  startYear: number,
  count: number,
  rate: number,
): Partial<Record<PotCategory, Map<number, number>>> {
  const years = new Map<number, number>()
  for (let y = startYear; y < startYear + count; y++) years.set(y, rate)
  return { pension: years, investments: years }
}
