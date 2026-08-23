/**
 * Everything the provider page shows, derived in one pure place.
 *
 * The page has two live controls — a fee toggle and a modelled balance — and
 * both re-derive the whole view. Keeping that in a pure function means the
 * arithmetic behind every figure on the page is testable without rendering
 * anything, and means the fee-on and fee-off views cannot drift apart by
 * being computed in different places.
 */
import { analyseDrawdown, type DrawdownAnalysis } from './drawdown.js'
import { applyFees, parseFeeTiers, tierBpsFor, totalFeePence, type FeeTier } from './fees.js'
import { buildSeries, netInvestedPence } from './series.js'
import { returnsAreEquivalent, simpleReturn, timeWeightedReturn } from './returns.js'
import { annualisedVolatility, type VolatilityResult } from './volatility.js'
import { daysBetween } from './dates.js'
import { MICRO } from './money.js'
import type { Flow, Reading, SeriesPoint } from './types.js'

/**
 * Below this many readings the page says so plainly and suppresses the
 * statistics. Three readings is the brief's own example, and its copy is the
 * right instinct: too early to mean anything is the point of publishing it.
 */
export const THIN_SERIES_THRESHOLD = 4

export type ProviderPagePortfolio = {
  inceptionDate: string
  initialPence: number
  platformFeeBps: number | null
  feeTiersJson: string | null
  ocfBps: number | null
}

export type ViewOptions = {
  feesDeducted: boolean
  /** the balance whose fee tier applies — the reader's choice, not the account's */
  modelledBalancePence: number
}

export type ProviderPageView = {
  /** the series actually plotted, after whatever fee treatment is selected */
  series: SeriesPoint[]
  grossSeries: SeriesPoint[]
  openingPence: number
  currentPence: number
  /** value scaled to the modelled balance, which is what the headline shows */
  scaledOpeningPence: number
  scaledCurrentPence: number
  twr: number | null
  simple: number | null
  returnsEquivalent: boolean
  netInvestedPence: number
  feesSoFarPence: number
  appliedFeeBps: number
  feeTiers: FeeTier[]
  drawdown: DrawdownAnalysis
  volatility: VolatilityResult
  readingCount: number
  weeksRunning: number
  lastValuationDate: string | null
  isThin: boolean
  hasFlows: boolean
}

export function buildProviderPageView(
  portfolio: ProviderPagePortfolio,
  readings: Reading[],
  flows: Flow[],
  options: ViewOptions,
): ProviderPageView {
  const input = {
    inceptionDate: portfolio.inceptionDate,
    initialPence: portfolio.initialPence,
    readings,
    flows,
  }

  const grossSeries = buildSeries(input)
  const feeTiers = parseFeeTiers(portfolio.feeTiersJson)
  const flatBps = portfolio.platformFeeBps ?? 0
  const appliedFeeBps =
    feeTiers.length > 0 ? tierBpsFor(options.modelledBalancePence, feeTiers, flatBps) : flatBps

  const netSeries = applyFees({
    points: grossSeries,
    modelledBalancePence: options.modelledBalancePence,
    tiers: feeTiers,
    flatBps,
  })

  const series = options.feesDeducted ? netSeries : grossSeries
  const last = series[series.length - 1] ?? null
  const first = series[0] ?? null

  const openingPence = first?.valuePence ?? portfolio.initialPence
  const currentPence = last?.valuePence ?? portfolio.initialPence

  // The headline restates the account at the reader's modelled balance, so a
  // £500 account and a £50,000 one are comparable at a glance. The unit price
  // carries the performance; the balance only scales it.
  const scale = options.modelledBalancePence / portfolio.initialPence
  const openingMultiple = (first?.unitPriceMicro ?? MICRO) / MICRO
  const currentMultiple = (last?.unitPriceMicro ?? MICRO) / MICRO

  const nonInitialFlows = flows.filter((flow) => flow.kind !== 'initial')

  return {
    series,
    grossSeries,
    openingPence,
    currentPence,
    scaledOpeningPence: Math.round(options.modelledBalancePence * openingMultiple),
    scaledCurrentPence: Math.round(options.modelledBalancePence * currentMultiple),
    twr: timeWeightedReturn(series),
    simple: simpleReturn(currentPence, netInvestedPence(input)),
    returnsEquivalent: returnsAreEquivalent(series),
    netInvestedPence: netInvestedPence(input),
    // Scaled the same way as the headline, so "fees so far" answers the
    // question the reader is actually asking: what would this have cost me.
    feesSoFarPence: Math.round(totalFeePence(grossSeries, netSeries) * scale),
    appliedFeeBps,
    feeTiers,
    drawdown: analyseDrawdown(series),
    volatility: annualisedVolatility(series),
    readingCount: readings.length,
    weeksRunning: last ? Math.max(0, Math.round(daysBetween(portfolio.inceptionDate, last.onDate) / 7)) : 0,
    lastValuationDate: last?.onDate ?? null,
    isThin: readings.length < THIN_SERIES_THRESHOLD,
    hasFlows: nonInitialFlows.length > 0,
  }
}

/**
 * Peer comparison — a band average and its spread, never a rank.
 *
 * `basis` is carried rather than assumed because it changes what the number
 * means. Grouping by relative volatility puts portfolios on a common scale
 * derived from how they actually behaved; grouping by each provider's own
 * risk label does not, since a "5 out of 10" at one firm is not a "5 out of
 * 10" at another. Until there is enough data for the former, the page has to
 * say openly that it is doing the latter.
 */
export type PeerBasis = 'relative_volatility' | 'provider_risk_label'

export type Peer = { label: string; returnFraction: number; isSelf: boolean }

export type PeerSummary = {
  basis: PeerBasis
  count: number
  self: number | null
  average: number
  widest: number
  narrowest: number
}

export function summarisePeerBand(peers: Peer[], basis: PeerBasis): PeerSummary | null {
  if (peers.length === 0) return null
  const returns = peers.map((peer) => peer.returnFraction)
  return {
    basis,
    count: peers.length,
    self: peers.find((peer) => peer.isSelf)?.returnFraction ?? null,
    average: returns.reduce((a, b) => a + b, 0) / returns.length,
    widest: Math.max(...returns),
    narrowest: Math.min(...returns),
  }
}
