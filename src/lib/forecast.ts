/**
 * Forecast — the whole-picture projection (pure, typed, unit-tested).
 *
 * Invested assets (pension + stocks/shares) grow at a nominal equity rate; cash
 * grows at a separate, lower rate — never the equity rate. Monthly contributions
 * are added to the invested pot and compounded monthly to a target age.
 *
 * Nominal (not inflation-adjusted); the rates are stated openly on /methodology.
 * No comparison to anyone — this only shows the consequences of your own numbers.
 */
import { CASH_RATE, INVESTED_RATE, TARGET_AGE } from '@/config'

export type ForecastInput = {
  age: number
  pension: number
  stocks: number
  cash: number
  /** monthly contribution to invested assets */
  monthly: number
}

export type Assumptions = {
  investedRate: number
  cashRate: number
  targetAge: number
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  investedRate: INVESTED_RATE,
  cashRate: CASH_RATE,
  targetAge: TARGET_AGE,
}

export type ScenarioKey = 'stop' | 'carryOn' | 'add100' | 'add500'

export type Scenario = {
  key: ScenarioKey
  label: string
  /** monthly contribution under this scenario */
  monthly: number
  /** projected total at the target age */
  total: number
  /** whether this is the user's current choice */
  current: boolean
}

export type ForecastResult = {
  assumptions: Assumptions
  monthsToTarget: number
  targetAge: number
  /** sum of all assets held today */
  todayTotal: number
  /** projected total at the target age */
  projectedTotal: number
  /** projected invested pot (pension + stocks + contributions, grown) */
  investedFuture: number
  /** projected cash (grown at the lower rate) */
  cashFuture: number
  /** starting balances + every contribution made */
  whatYouPutIn: number
  /** projected total − what you put in */
  marketAdds: number
  /** total contributions over the period */
  totalContributions: number
  scenarios: Scenario[]
}

const clampMoney = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

/** Convert a nominal annual rate to the equivalent monthly rate (effective). */
export function monthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1
}

/** Future value of a present lump sum after `months` at monthly rate `m`. */
export function futureValueLump(present: number, m: number, months: number): number {
  return present * Math.pow(1 + m, months)
}

/**
 * Future value of a level monthly contribution (paid at the end of each month)
 * after `months` at monthly rate `m`.
 */
export function futureValueContributions(
  monthly: number,
  m: number,
  months: number,
): number {
  if (months <= 0) return 0
  if (m === 0) return monthly * months
  return monthly * ((Math.pow(1 + m, months) - 1) / m)
}

function monthsToTarget(age: number, targetAge: number): number {
  return Math.max(0, Math.round((targetAge - age) * 12))
}

/** Projected total at the target age for a given monthly contribution. */
export function projectTotal(
  input: ForecastInput,
  monthly: number,
  a: Assumptions = DEFAULT_ASSUMPTIONS,
): number {
  const pension = clampMoney(input.pension)
  const stocks = clampMoney(input.stocks)
  const cash = clampMoney(input.cash)
  const months = monthsToTarget(input.age, a.targetAge)
  const mInv = monthlyRate(a.investedRate)
  const mCash = monthlyRate(a.cashRate)

  const invested =
    futureValueLump(pension + stocks, mInv, months) +
    futureValueContributions(clampMoney(monthly), mInv, months)
  const cashGrown = futureValueLump(cash, mCash, months)
  return invested + cashGrown
}

const SCENARIO_META: { key: ScenarioKey; label: string; delta: number | 'stop' }[] = [
  { key: 'stop', label: 'Stop contributing today', delta: 'stop' },
  { key: 'carryOn', label: 'Carry on as you are', delta: 0 },
  { key: 'add100', label: 'Add £100 a month', delta: 100 },
  { key: 'add500', label: 'Add £500 a month', delta: 500 },
]

/** Full forecast for the results screen. */
export function forecast(
  input: ForecastInput,
  a: Assumptions = DEFAULT_ASSUMPTIONS,
): ForecastResult {
  const pension = clampMoney(input.pension)
  const stocks = clampMoney(input.stocks)
  const cash = clampMoney(input.cash)
  const monthly = clampMoney(input.monthly)
  const months = monthsToTarget(input.age, a.targetAge)

  const mInv = monthlyRate(a.investedRate)
  const mCash = monthlyRate(a.cashRate)

  const investedFuture =
    futureValueLump(pension + stocks, mInv, months) +
    futureValueContributions(monthly, mInv, months)
  const cashFuture = futureValueLump(cash, mCash, months)
  const projectedTotal = investedFuture + cashFuture

  const todayTotal = pension + stocks + cash
  const totalContributions = monthly * months
  const whatYouPutIn = todayTotal + totalContributions
  const marketAdds = projectedTotal - whatYouPutIn

  const scenarios: Scenario[] = SCENARIO_META.map((s) => {
    const scenarioMonthly = s.delta === 'stop' ? 0 : monthly + s.delta
    return {
      key: s.key,
      label: s.label,
      monthly: scenarioMonthly,
      total: projectTotal(input, scenarioMonthly, a),
      current: s.key === 'carryOn',
    }
  })

  return {
    assumptions: a,
    monthsToTarget: months,
    targetAge: a.targetAge,
    todayTotal,
    projectedTotal,
    investedFuture,
    cashFuture,
    whatYouPutIn,
    marketAdds,
    totalContributions,
    scenarios,
  }
}
