/**
 * Volatility, and the honesty gate in front of it.
 *
 *     annualised_vol = stdev(weekly log returns) x sqrt(52)
 *     relative_vol   = portfolio annualised_vol / global equity benchmark vol
 *
 * `relative_vol` is the most valuable output in the system and the one that
 * takes longest to earn: it is what eventually allows portfolios to be
 * grouped across providers on a common scale, instead of trusting each firm's
 * own risk label, which means nothing between one firm and the next. The
 * plumbing exists now; the number stays hidden until the data supports it.
 *
 * ## The sufficiency gate
 *
 * Under 26 readings the figure is not shown at all. Between 26 and 156 it is
 * shown marked provisional. From 156 (three years) it stands unqualified.
 *
 * Absent means absent, not zero. A volatility of 0.0% reads as "this
 * portfolio never moves", which is a claim; showing nothing reads as "we
 * cannot say yet", which is the truth. The gate returns null precisely so
 * that the UI cannot accidentally render a confident-looking zero.
 */
import type { SeriesPoint } from './types'
import { logReturns } from './returns'

export const MIN_READINGS_FOR_VOLATILITY = 26
export const MIN_READINGS_FOR_UNQUALIFIED = 156

const WEEKS_PER_YEAR = 52

export type Sufficiency = 'insufficient' | 'provisional' | 'sufficient'

export function sufficiencyFor(readingCount: number): Sufficiency {
  if (readingCount < MIN_READINGS_FOR_VOLATILITY) return 'insufficient'
  if (readingCount < MIN_READINGS_FOR_UNQUALIFIED) return 'provisional'
  return 'sufficient'
}

/** Sample standard deviation — n-1, the convention for an observed sample. */
export function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

export type VolatilityResult = {
  annualised: number | null
  sufficiency: Sufficiency
  readingCount: number
  /** true when the figure may be shown, with or without a provisional marker */
  isDisplayable: boolean
  isProvisional: boolean
}

/**
 * `readingCount` counts genuine observations, not series points: a
 * forward-filled point contributes a zero return that would drag measured
 * volatility down toward a number the data does not support.
 */
export function annualisedVolatility(points: SeriesPoint[]): VolatilityResult {
  const readingCount = points.filter((p) => !p.isForwardFilled).length
  const sufficiency = sufficiencyFor(readingCount)

  if (sufficiency === 'insufficient') {
    return {
      annualised: null,
      sufficiency,
      readingCount,
      isDisplayable: false,
      isProvisional: false,
    }
  }

  const stdev = standardDeviation(logReturns(points))
  return {
    annualised: stdev === null ? null : stdev * Math.sqrt(WEEKS_PER_YEAR),
    sufficiency,
    readingCount,
    isDisplayable: stdev !== null,
    isProvisional: sufficiency === 'provisional',
  }
}

export function relativeVolatility(
  portfolio: VolatilityResult,
  benchmarkAnnualised: number | null,
): number | null {
  if (!portfolio.isDisplayable || portfolio.annualised === null) return null
  if (benchmarkAnnualised === null || benchmarkAnnualised === 0) return null
  return portfolio.annualised / benchmarkAnnualised
}

// ── peer bands ────────────────────────────────────────────────────────────
//
// Bands report a mean and a spread. Never a rank, never a "best" — the whole
// point is to situate a portfolio among comparable ones, and a league table
// would turn that into a recommendation, which this project does not make.

export const PEER_BANDS = [
  { id: 'very-low', label: 'Very low', max: 0.4 },
  { id: 'low', label: 'Low', max: 0.6 },
  { id: 'medium', label: 'Medium', max: 0.8 },
  { id: 'high', label: 'High', max: 1.0 },
  { id: 'very-high', label: 'Very high', max: Infinity },
] as const

export type PeerBandId = (typeof PEER_BANDS)[number]['id']

export function bandForRelativeVolatility(relativeVol: number): PeerBandId {
  return (PEER_BANDS.find((band) => relativeVol < band.max) ?? PEER_BANDS[PEER_BANDS.length - 1]!).id
}

export type PeerBandSummary = {
  count: number
  mean: number
  min: number
  max: number
}

/**
 * Summarises a set of peer returns. `basis` records how the peers were
 * grouped, because until relative volatility is available the grouping falls
 * back to each provider's own risk label — which is not comparable between
 * firms, and the page has to say so openly rather than imply a common scale
 * that does not exist.
 */
export function summarisePeers(returns: number[]): PeerBandSummary | null {
  if (returns.length === 0) return null
  return {
    count: returns.length,
    mean: returns.reduce((a, b) => a + b, 0) / returns.length,
    min: Math.min(...returns),
    max: Math.max(...returns),
  }
}

export type PeerBasis = 'relative_volatility' | 'provider_risk_label'
