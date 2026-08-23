/**
 * Drawdown — the deepest fall from a previous high, and whether it recovered.
 *
 *     peak(t)      = max unit_price over [inception, t]
 *     drawdown(t)  = unit_price(t) / peak(t) - 1
 *     max_drawdown = min over t
 *     trough_date  = argmin
 *     recovery     = first date after trough where unit_price >= peak at trough
 *
 * The brief gives this figure more visual weight than the growth number, and
 * that is the right way round: a fall is what actually tests whether someone
 * stays invested, and it is the number most performance pages bury.
 *
 * When a portfolio has not recovered, recovery is null and the page says
 * "not recovered — N weeks and counting". That state has to look deliberate
 * rather than broken, so it is modelled explicitly rather than left as an
 * absent field for the UI to interpret.
 */
import { weeksBetween } from './dates.js'
import type { SeriesPoint } from './types.js'

export type DrawdownPoint = {
  onDate: string
  /** 0 at a peak, negative below it */
  drawdown: number
  peakPriceMicro: number
}

export type DrawdownAnalysis = {
  /** the full series of drawdowns, for shading the chart */
  series: DrawdownPoint[]
  /** most negative drawdown reached; 0 when the price only ever rose */
  maxDrawdown: number
  peakDate: string | null
  troughDate: string | null
  /** null when the fall has not yet been recovered */
  recoveryDate: string | null
  /** weeks from trough to recovery, or null if not recovered */
  recoveryWeeks: number | null
  /** weeks since the trough when still under water */
  weeksSinceTrough: number | null
  hasRecovered: boolean
}

export function analyseDrawdown(points: SeriesPoint[]): DrawdownAnalysis {
  const empty: DrawdownAnalysis = {
    series: [],
    maxDrawdown: 0,
    peakDate: null,
    troughDate: null,
    recoveryDate: null,
    recoveryWeeks: null,
    weeksSinceTrough: null,
    hasRecovered: true,
  }
  if (points.length === 0) return empty

  const series: DrawdownPoint[] = []
  let peakPrice = points[0]!.unitPriceMicro
  let peakDate = points[0]!.onDate
  let maxDrawdown = 0
  let troughIndex = -1
  let peakAtTroughPrice = peakPrice
  let peakAtTroughDate = peakDate

  points.forEach((point, index) => {
    if (point.unitPriceMicro > peakPrice) {
      peakPrice = point.unitPriceMicro
      peakDate = point.onDate
    }
    const drawdown = peakPrice === 0 ? 0 : point.unitPriceMicro / peakPrice - 1
    series.push({ onDate: point.onDate, drawdown, peakPriceMicro: peakPrice })

    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown
      troughIndex = index
      peakAtTroughPrice = peakPrice
      peakAtTroughDate = peakDate
    }
  })

  if (troughIndex === -1) {
    // Never fell below a previous high.
    return { ...empty, series }
  }

  const troughDate = points[troughIndex]!.onDate

  // Recovery is measured against the peak that stood at the trough, not
  // against any later high — the question is when the money that was lost
  // came back, not when a new record was set.
  let recoveryDate: string | null = null
  for (let i = troughIndex + 1; i < points.length; i++) {
    if (points[i]!.unitPriceMicro >= peakAtTroughPrice) {
      recoveryDate = points[i]!.onDate
      break
    }
  }

  const lastDate = points[points.length - 1]!.onDate

  return {
    series,
    maxDrawdown,
    peakDate: peakAtTroughDate,
    troughDate,
    recoveryDate,
    recoveryWeeks: recoveryDate ? weeksBetween(troughDate, recoveryDate) : null,
    weeksSinceTrough: recoveryDate ? null : weeksBetween(troughDate, lastDate),
    hasRecovered: recoveryDate !== null,
  }
}
