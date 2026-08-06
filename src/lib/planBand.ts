/**
 * Orchestrates {mid, low, high} scheduled projections plus each one's own
 * crossover year (spec: down-years sequence-of-returns modelling).
 *
 * For an accumulation-only plan, any down-run can only ever REDUCE the
 * ending balance relative to none — compounding is monotonic here. So:
 *  - mid  = today's existing single-line projection, unchanged, no
 *           down-run applied.
 *  - low  = the N-year down-run at whichever start-year produces the
 *           WORST ending balance.
 *  - high = the SAME stress event at whichever start-year produces the
 *           BEST ending balance — not "no down-run at all," and not a
 *           mirrored up-run. This only ever stress-tests the downside.
 * Trade-off, stated openly rather than hidden: mid will often sit near the
 * top of the band rather than centred — a real property of "worst
 * placement vs best placement of the SAME bad event," not a bug.
 *
 * When downYearsCount is 0 (or the horizon can't fit even one down-run),
 * low and high collapse to exactly mid — a zero-width band, not a hidden
 * feature.
 */
import { DOWN_YEAR_RATE } from '../config.js'
import { downYearRateOverrides, findDownYearPlacements } from './downYears.js'
import {
  findScheduledCrossoverYear,
  projectScheduledYearly,
  type ScheduledPlanInput,
  type ScheduledYearPoint,
} from './scheduledPlan.js'

export type PlanBandSeries = {
  points: ScheduledYearPoint[]
  crossoverYear: number | null
}

export type PlanBand = {
  mid: PlanBandSeries
  low: PlanBandSeries
  high: PlanBandSeries
  /** the down-run's own placement behind low/high — null when there's no
   *  band (downYearsCount is 0, or the horizon can't fit one) */
  lowStartYear: number | null
  highStartYear: number | null
}

function seriesFor(points: ScheduledYearPoint[]): PlanBandSeries {
  return { points, crossoverYear: findScheduledCrossoverYear(points) }
}

/**
 * Only the FINAL ending value is guaranteed low <= high, by construction —
 * that's the one figure the worst/best placement search actually optimises
 * for. At an intermediate year, low and high can genuinely cross: a placed-
 * late loss on a large balance can end up costing more than a placed-early
 * loss on a small one, even though it lands second in the horizon. That's
 * real sequence-of-returns behaviour, not a bug — but a display (a range
 * column, a band-chart fill) still needs low <= high at every single point
 * it renders, or a table row reads backwards and a chart polygon
 * self-intersects. This reorders a pair for display without touching
 * either series' own data.
 */
export function orderedBandRange(a: number, b: number): { low: number; high: number } {
  return a <= b ? { low: a, high: b } : { low: b, high: a }
}

/**
 * Slices a band series at a specific age — the investments pot's value
 * (never pension, locked until its own access age; never cash, a separate
 * job) at whichever point matches that age exactly. Null when the age
 * falls outside the projected horizon (before today's age, or beyond the
 * final projected year) — a real "we can't answer this" rather than a
 * guess (see bridgeCheck.ts).
 */
export function investmentsValueAtAge(points: ScheduledYearPoint[], age: number): number | null {
  const point = points.find((p) => p.age === age)
  return point ? point.investments.endValue : null
}

export function buildPlanBand(input: ScheduledPlanInput, downYearsCount: number): PlanBand {
  const midPoints = projectScheduledYearly(input)
  const mid = seriesFor(midPoints)

  const years = Math.max(0, Math.round(input.targetAge - input.age))
  const placements = findDownYearPlacements({
    count: downYearsCount,
    earliestYear: input.startYear + 1,
    latestYear: input.startYear + years,
    scoreStartYear: (startYear) => {
      const points = projectScheduledYearly({
        ...input,
        rateOverrides: downYearRateOverrides(startYear, downYearsCount, DOWN_YEAR_RATE),
      })
      return points.at(-1)!.total.endValue
    },
  })

  if (!placements) {
    return { mid, low: mid, high: mid, lowStartYear: null, highStartYear: null }
  }

  const lowPoints = projectScheduledYearly({
    ...input,
    rateOverrides: downYearRateOverrides(placements.worst.startYear, downYearsCount, DOWN_YEAR_RATE),
  })
  const highPoints = projectScheduledYearly({
    ...input,
    rateOverrides: downYearRateOverrides(placements.best.startYear, downYearsCount, DOWN_YEAR_RATE),
  })

  return {
    mid,
    low: seriesFor(lowPoints),
    high: seriesFor(highPoints),
    lowStartYear: placements.worst.startYear,
    highStartYear: placements.best.startYear,
  }
}
