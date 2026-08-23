/**
 * What the platform fee costs in pounds, and how that sits against the band.
 *
 * Fees are the most durable difference between same-risk portfolios. Returns
 * over a run this short are mostly the market; the rate card is a fact about
 * the provider that will still be true in ten years. So the charge gets a
 * block rather than a cell.
 *
 * ## The projection is arithmetic, not a forecast
 *
 * `projectedCostPence` compounds the published rate against a balance held
 * flat for ten years. It deliberately assumes no growth, no contributions and
 * no change to the rate card — none of which will be true. It is not a
 * prediction of what anyone will pay; it is the size of the published charge
 * expressed over a period long enough to be legible, which a percentage is
 * not. The page has to say so in as many words, and does.
 *
 * Nothing here ranks providers, recommends one, or suggests a moment to act.
 */
import { parseFeeTiers, tierBpsFor } from './fees.js'

/** Years the projection runs over. Ten because it is a horizon, not a plan. */
export const PROJECTION_YEARS = 10

export type CostInput = {
  platformFeeBps: number | null
  feeTiersJson: string | null
}

/** The annual charge in pence on a balance held flat. */
export function annualCostPence(feeBps: number, balancePence: number): number {
  return Math.round((balancePence * feeBps) / 10_000)
}

/**
 * The charge over PROJECTION_YEARS on a balance held flat.
 *
 * Compounded daily, matching how the fee is modelled everywhere else, then
 * expressed as the total taken rather than the ending balance — the question
 * is what the charge costs, not what the pot becomes.
 */
export function projectedCostPence(
  feeBps: number,
  balancePence: number,
  years = PROJECTION_YEARS,
): number {
  if (feeBps <= 0 || balancePence <= 0) return 0
  const dailyRate = feeBps / 10_000 / 365
  const remaining = balancePence * (1 - dailyRate) ** Math.round(years * 365)
  return Math.round(balancePence - remaining)
}

export type BandCost = {
  /** the rate this portfolio charges at the modelled balance */
  feeBps: number
  annualPence: number
  projectedPence: number
  /** null when nothing else is tracked in the band */
  bandAverageBps: number | null
  bandLowestBps: number | null
  bandHighestBps: number | null
  bandAverageAnnualPence: number | null
  /** how this portfolio's annual charge compares with the band average */
  differenceFromAveragePence: number | null
  peerCount: number
}

export function feeBpsFor(input: CostInput, balancePence: number): number {
  const tiers = parseFeeTiers(input.feeTiersJson)
  const flat = input.platformFeeBps ?? 0
  return tiers.length > 0 ? tierBpsFor(balancePence, tiers, flat) : flat
}

/**
 * This portfolio's cost beside the band's.
 *
 * Every rate is resolved at the same modelled balance, because tiered cards
 * mean the cheapest provider at £5,000 is often not the cheapest at £50,000.
 * Comparing headline rates rather than the rate each would actually charge
 * this reader would be comparing the marketing.
 */
export function buildBandCost(
  self: CostInput,
  peers: CostInput[],
  balancePence: number,
): BandCost {
  const feeBps = feeBpsFor(self, balancePence)
  const peerBps = peers.map((peer) => feeBpsFor(peer, balancePence))

  // The band includes this portfolio: it is one of the things at this risk
  // level, and an "average" that excluded it would shift every time the
  // reader moved between pages.
  const allBps = [feeBps, ...peerBps]
  const hasBand = peerBps.length > 0

  const averageBps = hasBand
    ? allBps.reduce((a, b) => a + b, 0) / allBps.length
    : null

  return {
    feeBps,
    annualPence: annualCostPence(feeBps, balancePence),
    projectedPence: projectedCostPence(feeBps, balancePence),
    bandAverageBps: averageBps,
    bandLowestBps: hasBand ? Math.min(...allBps) : null,
    bandHighestBps: hasBand ? Math.max(...allBps) : null,
    bandAverageAnnualPence:
      averageBps === null ? null : annualCostPence(averageBps, balancePence),
    differenceFromAveragePence:
      averageBps === null
        ? null
        : annualCostPence(feeBps, balancePence) - annualCostPence(averageBps, balancePence),
    peerCount: peerBps.length,
  }
}
