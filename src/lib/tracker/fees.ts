/**
 * Platform fee modelling.
 *
 * The observed unit price is already net of the underlying fund charges —
 * they sit inside the fund's own price — but gross of the platform fee the
 * provider bills separately. So the fee has to be modelled rather than
 * observed:
 *
 *     daily_rate   = tier_bps_for(modelled_balance) / 10000 / 365
 *     net_price(t) = gross_price(t) x PRODUCT over elapsed days (1 - daily_rate)
 *
 * `ocf_bps` is deliberately never applied here. It is already inside the
 * price, and applying it again would double-count the largest charge in the
 * stack — the single easiest way to publish a wrong number with total
 * confidence.
 *
 * The modelled balance is chosen by the reader, not fixed. A £500 pot and a
 * £50,000 pot can sit in different fee tiers, and a comparison that quietly
 * assumes one of them is answering a question nobody asked.
 */
import { MICRO } from './money.js'
import { daysBetween } from './dates.js'
import type { SeriesPoint } from './types.js'

export type FeeTier = {
  /** inclusive upper bound in pence; null means "everything above" */
  upto_pence: number | null
  bps: number
}

/**
 * The tier a customer holding this balance actually pays.
 *
 * Whole-balance selection, not marginal banding: the brief's model is "a
 * £50,000 view uses the tier a £50,000 customer would actually pay". The
 * bound is inclusive, so a balance sitting exactly on a boundary pays the
 * lower tier.
 */
export function tierBpsFor(balancePence: number, tiers: FeeTier[], fallbackBps = 0): number {
  if (tiers.length === 0) return fallbackBps
  const ordered = [...tiers].sort((a, b) => {
    if (a.upto_pence === null) return 1
    if (b.upto_pence === null) return -1
    return a.upto_pence - b.upto_pence
  })
  for (const tier of ordered) {
    if (tier.upto_pence === null || balancePence <= tier.upto_pence) return tier.bps
  }
  return ordered[ordered.length - 1]?.bps ?? fallbackBps
}

export function parseFeeTiers(json: string | null | undefined): FeeTier[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? (parsed as FeeTier[]) : []
  } catch {
    return []
  }
}

export type FeeModelInput = {
  points: SeriesPoint[]
  /** the balance whose tier applies — the reader's choice, not the portfolio's */
  modelledBalancePence: number
  tiers: FeeTier[]
  /** flat annual rate used when the provider has no tiers */
  flatBps?: number
}

/**
 * The series with the platform fee applied, compounded daily from inception.
 *
 * Unit counts are untouched: a fee reduces what a unit is worth, it does not
 * take units away. Keeping units constant is what lets the fee toggle switch
 * back and forth without the two views disagreeing about anything else.
 */
export function applyFees(input: FeeModelInput): SeriesPoint[] {
  const { points, modelledBalancePence, tiers, flatBps = 0 } = input
  if (points.length === 0) return []

  const bps = tiers.length > 0 ? tierBpsFor(modelledBalancePence, tiers, flatBps) : flatBps
  if (bps === 0) return points

  const dailyRate = bps / 10_000 / 365
  const inception = points[0]!.onDate

  return points.map((point) => {
    const elapsed = daysBetween(inception, point.onDate)
    const factor = (1 - dailyRate) ** elapsed
    const netPriceMicro = Math.round(point.unitPriceMicro * factor)
    return {
      ...point,
      unitPriceMicro: netPriceMicro,
      valuePence: Math.round((point.unitsMicro / MICRO) * (netPriceMicro / MICRO)),
    }
  })
}

/**
 * Modelled fees against charges actually observed on statements.
 *
 * A model more than ~10% adrift from what was really billed means the rate
 * card being modelled is wrong, and the admin dashboard should say so rather
 * than let a plausible-looking wrong number stand.
 */
export function reconcileFees(modelledPence: number, observedPence: number) {
  const variance = observedPence === 0 ? null : (modelledPence - observedPence) / observedPence
  return {
    modelledPence,
    observedPence,
    variance,
    isAdrift: variance !== null && Math.abs(variance) > 0.1,
  }
}

/** Total fee borne across the series — gross value less net value at the end. */
export function totalFeePence(gross: SeriesPoint[], net: SeriesPoint[]): number {
  const lastGross = gross[gross.length - 1]
  const lastNet = net[net.length - 1]
  if (!lastGross || !lastNet) return 0
  return lastGross.valuePence - lastNet.valuePence
}
