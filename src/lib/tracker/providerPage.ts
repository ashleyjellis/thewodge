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
import { applyFees, parseFeeTiers, tierBpsFor, type FeeTier } from './fees.js'
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
  /**
   * Both fee treatments at the modelled balance, always — not just whichever
   * the toggle currently shows.
   *
   * The page states a fee in pounds beside a headline, and a reader is
   * entitled to subtract one from the other and get the same answer the other
   * toggle position gives. That only holds if all three come from the same
   * rounding, so all three are derived here together rather than each being
   * rounded on its own path.
   */
  scaledGrossCurrentPence: number
  scaledNetCurrentPence: number
  /** modelled balance over the real initial investment — the ledger's scale too */
  scale: number
  /** days from inception to the last point, for modelling a peer's fee drag */
  daysRunning: number
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

  // Both treatments at the modelled balance, rounded once each, so the
  // difference between them IS the fee the page prints.
  //
  // Deriving the fee independently — scaling the real-account fee by the
  // balance ratio, as this used to — rounds on a different path and lands a
  // few pence away. At £500 scaled to £20,000 that was 14p: invisible on its
  // own, and fatal to the one arithmetic check a sceptical reader will
  // actually perform, which is subtracting the fee from the gross headline
  // and expecting the net one.
  const lastGross = grossSeries[grossSeries.length - 1]
  const lastNet = netSeries[netSeries.length - 1]
  const scaledGrossCurrentPence = Math.round(
    options.modelledBalancePence * ((lastGross?.unitPriceMicro ?? MICRO) / MICRO),
  )
  const scaledNetCurrentPence = Math.round(
    options.modelledBalancePence * ((lastNet?.unitPriceMicro ?? MICRO) / MICRO),
  )

  const nonInitialFlows = flows.filter((flow) => flow.kind !== 'initial')

  return {
    series,
    grossSeries,
    openingPence,
    currentPence,
    scaledOpeningPence: Math.round(options.modelledBalancePence * openingMultiple),
    scaledCurrentPence: Math.round(options.modelledBalancePence * currentMultiple),
    scaledGrossCurrentPence,
    scaledNetCurrentPence,
    scale,
    daysRunning: last ? Math.max(0, daysBetween(portfolio.inceptionDate, last.onDate)) : 0,
    twr: timeWeightedReturn(series),
    simple: simpleReturn(currentPence, netInvestedPence(input)),
    returnsEquivalent: returnsAreEquivalent(series),
    netInvestedPence: netInvestedPence(input),
    feesSoFarPence: scaledGrossCurrentPence - scaledNetCurrentPence,
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

// ── the ledger ────────────────────────────────────────────────────────────

export type LedgerRow = {
  onDate: string
  /** null for the opening position, which nobody read off a screen */
  readOn: string | null
  unitPriceMicro: number
  /** at the modelled balance, not at the size of the real account */
  scaledValuePence: number
  /** null on the first row — there is nothing before it to move from */
  weekMove: number | null
  isOpening: boolean
  isForwardFilled: boolean
  source: string
}

/**
 * The ledger's rows, built rather than derived inline in the table.
 *
 * Both of this table's defects were arithmetic done in JSX where nothing
 * could reach it: the opening row was filtered out, so last-price over
 * first-price disagreed with the headline; and the value column stayed at the
 * real account's scale while the headline was restated at the reader's
 * balance, so the two read as different portfolios. Neither was visible to a
 * test. Now they are.
 */
export function buildLedgerRows(
  points: SeriesPoint[],
  // readAt is optional because it genuinely can be: it is stamped when a
  // reading is saved, and the demo dataset describes readings before that
  // happens. Guarding only the reading and not the field threw a TypeError
  // the first time this ran against one.
  readings: { valuationDate: string; readAt?: string | null; source: string }[],
  scale: number,
): LedgerRow[] {
  const readingByDate = new Map(readings.map((reading) => [reading.valuationDate, reading]))

  return points.map((point, index) => {
    const previous = points[index - 1]
    const reading = readingByDate.get(point.onDate)
    return {
      onDate: point.onDate,
      readOn: point.isOpening ? null : (reading?.readAt?.slice(0, 10) ?? null),
      unitPriceMicro: point.unitPriceMicro,
      // Units scaled, then priced — NOT the stored value multiplied by the
      // ratio.
      //
      // The stored value is already rounded to whole pence at the real
      // account's size, so multiplying it by forty magnifies a third of a
      // penny into fourteen. That put £24,116.40 in the last row under a
      // £24,116.54 headline: the same number, twice, differently. Scaling the
      // units instead defers the only rounding to the end, which lands on the
      // headline exactly — and unlike simply pricing the modelled balance, it
      // still shows a contribution stepping the value up, which is most of
      // what the ledger is for.
      scaledValuePence: Math.round(
        (point.unitsMicro / MICRO) * scale * (point.unitPriceMicro / MICRO),
      ),
      weekMove:
        previous && previous.unitPriceMicro > 0
          ? point.unitPriceMicro / previous.unitPriceMicro - 1
          : null,
      isOpening: point.isOpening,
      isForwardFilled: point.isForwardFilled,
      source: point.isOpening
        ? 'opening position'
        : point.isForwardFilled
          ? 'no reading — carried forward'
          : (reading?.source ?? '—'),
    }
  })
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

export type Peer = {
  label: string
  /** gross of the platform fee, always — netPeerReturn applies it */
  returnFraction: number
  isSelf: boolean
  providerSlug?: string
  slug?: string
  /** days inception to last reading, so a fee can be compounded over the run */
  days?: number
  platformFeeBps?: number | null
  feeTiersJson?: string | null
}

/**
 * A peer's return after its own platform fee, at the reader's modelled balance.
 *
 * Every peer must get the same fee treatment as the portfolio being read
 * about, or the comparison is this one net against the others gross — which
 * would flatter or damn it purely by which toggle the reader had pressed.
 *
 * Derived rather than recomputed from a series, because the fee is a constant
 * daily drag from inception and the whole series is not needed to model it:
 *
 *     net_price(t) = gross_price(t) x (1 - daily)^days(t)
 *
 * and a since-inception return is last over first, where the first point sits
 * at day zero and its factor is exactly 1. So the drag on the return is the
 * final day's factor and nothing else. Sending six peers' entire series to the
 * browser to rediscover that would be a great deal of work for the same
 * number.
 */
export function netPeerReturn(
  grossReturn: number,
  feeBps: number | null | undefined,
  days: number,
): number {
  if (!feeBps || feeBps <= 0 || days <= 0) return grossReturn
  const dailyRate = feeBps / 10_000 / 365
  return (1 + grossReturn) * (1 - dailyRate) ** days - 1
}

/** The fee rate a peer charges the reader's modelled balance. */
export function peerFeeBps(peer: Peer, modelledBalancePence: number): number {
  const tiers = parseFeeTiers(peer.feeTiersJson)
  const flat = peer.platformFeeBps ?? 0
  return tiers.length > 0 ? tierBpsFor(modelledBalancePence, tiers, flat) : flat
}

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
