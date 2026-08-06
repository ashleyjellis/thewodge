/**
 * "What's an extra bit of money actually worth?" — MarginalValueCalculator's
 * engine. A thin, pure wrapper around forecast.ts's already-exported,
 * already-pure future-value primitives — no new maths, no engine changes.
 * Two modes: a one-off top-up today (futureValueLump) vs an ongoing extra
 * amount every month (futureValueContributions) — different questions,
 * same split of the answer into what you actually put in vs what growth
 * added on top.
 */
import { futureValueContributions, futureValueLump, monthlyRate } from './forecast.js'

export type MarginalValueMode = 'monthly' | 'lump'

export type MarginalValueResult = {
  amount: number
  mode: MarginalValueMode
  months: number
  totalContributed: number
  futureValue: number
  growth: number
}

export function calculateMarginalValue(params: {
  amount: number
  mode: MarginalValueMode
  annualRate: number
  months: number
}): MarginalValueResult {
  const m = monthlyRate(params.annualRate)
  const months = Math.max(0, params.months)
  const futureValue =
    params.mode === 'monthly'
      ? futureValueContributions(params.amount, m, months)
      : futureValueLump(params.amount, m, months)
  const totalContributed = params.mode === 'monthly' ? params.amount * months : params.amount

  return {
    amount: params.amount,
    mode: params.mode,
    months,
    totalContributed,
    futureValue,
    growth: futureValue - totalContributed,
  }
}
