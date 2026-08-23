/**
 * Returns.
 *
 *     TWR(a -> b)   = unit_price(b) / unit_price(a) - 1
 *     Simple return = (value(b) - net_invested(b)) / net_invested(b)
 *
 * With a single initial investment and no further flows these are
 * arithmetically identical, and the UI says so rather than hiding it. That
 * identity is the clearest way to explain what the two numbers mean: they
 * only diverge once money moves in or out, and the size of the divergence is
 * entirely a fact about timing, not about the manager.
 */
import { MICRO } from './money'
import type { SeriesPoint } from './types'

/**
 * Time-weighted return between two points in the series.
 *
 * Defaults to since-inception, which for this product is the only timeframe
 * offered until there is enough history for anything shorter to mean
 * something.
 */
export function timeWeightedReturn(points: SeriesPoint[], fromIndex = 0, toIndex?: number): number | null {
  if (points.length === 0) return null
  const to = points[toIndex ?? points.length - 1]
  const from = points[fromIndex]
  if (!from || !to || from.unitPriceMicro === 0) return null
  return to.unitPriceMicro / from.unitPriceMicro - 1
}

/** (value - net invested) / net invested. */
export function simpleReturn(valuePence: number, netInvestedPence: number): number | null {
  if (netInvestedPence === 0) return null
  return (valuePence - netInvestedPence) / netInvestedPence
}

/**
 * Whether the two measures are the same number here.
 *
 * True only when nothing has moved in or out since inception, in which case
 * the page states the equivalence outright instead of printing two identical
 * figures and leaving the reader to wonder what they missed.
 */
export function returnsAreEquivalent(points: SeriesPoint[]): boolean {
  if (points.length < 2) return true
  const openingUnits = points[0]!.unitsMicro
  return points.every((p) => p.unitsMicro === openingUnits)
}

/** Log return between consecutive points — the input to volatility. */
export function logReturns(points: SeriesPoint[]): number[] {
  const out: number[] = []
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]!.unitPriceMicro
    const current = points[i]!.unitPriceMicro
    if (previous > 0 && current > 0) out.push(Math.log(current / previous))
  }
  return out
}

/** The unit price as a plain multiple of its opening value, e.g. 1.0369. */
export function priceMultiple(point: SeriesPoint): number {
  return point.unitPriceMicro / MICRO
}
