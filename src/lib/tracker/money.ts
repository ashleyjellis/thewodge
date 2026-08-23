/**
 * Integer money, and exact arithmetic on it.
 *
 * The tracker's first non-negotiable is that money is never a float. Currency
 * is an integer of pence; unit prices and unit counts are integers scaled by
 * one million (micro-units); fee rates are integer basis points. Formatting
 * happens at the very last moment, in this module and nowhere else.
 *
 * ## Why BigInt appears at all
 *
 * Converting between these scales needs intermediates that do not fit in a
 * JavaScript number. Deriving a unit price is
 * `value_pence x 1e12 / units_micro`, and for a £518.45 holding that
 * numerator is 5.18e16 — past Number.MAX_SAFE_INTEGER at 9.007e15, where the
 * language stops guaranteeing that an integer is represented exactly.
 *
 * Being precise about what that does and does not mean, because it is easy to
 * overstate: doing this in plain doubles produces the same answer as exact
 * arithmetic across every realistic input. A sweep of ~11,000 combinations of
 * portfolio value and unit count found no divergence at all, and it takes
 * something absurd — a £1bn holding at a unit price of 0.001 — before the two
 * disagree. The numerator's representation error is minuscule relative to the
 * quotient, so it almost never reaches the rounding boundary.
 *
 * So BigInt here is not fixing an observed drift. It makes exactness a
 * property of the code rather than of the input range: nobody has to re-run
 * that sweep when portfolios get larger, when the micro scale changes, or
 * when a new conversion is added. Given the cost is a few type conversions in
 * one module, and the brief's whole premise is a series published as a
 * verified record, guaranteed beats empirically-fine.
 */

/** Scale factor for unit prices and unit counts. */
export const MICRO = 1_000_000
/** MICRO squared — the factor between (pence x micro) and micro. */
const MICRO_SQUARED_BIG = 1_000_000_000_000n

/**
 * Integer division rounding half away from zero, rather than truncating.
 *
 * Truncation would bias every conversion consistently downward, and a
 * consistent bias compounds across a long series in exactly the way a random
 * rounding error does not.
 */
export function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error('divRound: division by zero')
  const negative = numerator < 0n !== denominator < 0n
  const a = numerator < 0n ? -numerator : numerator
  const b = denominator < 0n ? -denominator : denominator
  const quotient = (a * 2n + b) / (b * 2n)
  return negative ? -quotient : quotient
}

/** unit_price = value / units, expressed in micro-units. */
export function unitPriceMicro(valuePence: number, unitsMicro: number): number {
  if (unitsMicro === 0) throw new Error('unitPriceMicro: portfolio holds no units')
  return Number(divRound(BigInt(valuePence) * MICRO_SQUARED_BIG, BigInt(unitsMicro)))
}

/** How many units an amount buys at a given price. Negative for a withdrawal. */
export function unitsForAmountMicro(amountPence: number, priceMicro: number): number {
  if (priceMicro === 0) throw new Error('unitsForAmountMicro: unit price is zero')
  return Number(divRound(BigInt(amountPence) * MICRO_SQUARED_BIG, BigInt(priceMicro)))
}

/** value = units x price, back in whole pence. */
export function valueFromUnits(unitsMicro: number, priceMicro: number): number {
  return Number(divRound(BigInt(unitsMicro) * BigInt(priceMicro), MICRO_SQUARED_BIG))
}

/** Micro-units as a plain number, for arithmetic where exactness is not at stake. */
export function fromMicro(micro: number): number {
  return micro / MICRO
}

export function toMicro(value: number): number {
  return Math.round(value * MICRO)
}

// ── formatting ────────────────────────────────────────────────────────────

const GBP = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** 51845 -> "£518.45" */
export function formatPence(pence: number): string {
  return GBP.format(pence / 100)
}

/** 51845 -> "£518" — for axis labels and other places precision is noise. */
export function formatPenceRounded(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100)
}

/** 1036900 -> "1.036900". Six places, always — a unit price is not money. */
export function formatUnitPrice(priceMicro: number): string {
  return (priceMicro / MICRO).toFixed(6)
}

/** 75 -> "0.75%" */
export function formatBps(bps: number, dp = 2): string {
  return `${(bps / 100).toFixed(dp)}%`
}

/** 0.0369 -> "+3.69%". Signed, because direction is the point. */
export function formatReturn(fraction: number, dp = 2): string {
  const pct = fraction * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(dp)}%`
}

/**
 * Parses a typed value into pence, tolerating what a human actually types
 * when copying a figure off a provider's screen: a currency symbol, thousands
 * separators, stray spaces, a trailing full stop.
 *
 * Returns null rather than a guess when the input is not a number — the admin
 * grid needs to tell "not filled in yet" apart from "zero", and silently
 * reading an unparseable entry as 0 would write a fabricated reading.
 */
export function parsePence(input: string): number | null {
  const cleaned = input.replace(/[£$,\s]/g, '').replace(/\.$/, '')
  if (cleaned === '' || cleaned === '-') return null
  if (!/^-?\d*(\.\d*)?$/.test(cleaned)) return null
  const asNumber = Number(cleaned)
  if (!Number.isFinite(asNumber)) return null
  return Math.round(asNumber * 100)
}
