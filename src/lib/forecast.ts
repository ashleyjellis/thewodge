/**
 * Forecast — the whole-picture projection (pure, typed, unit-tested).
 *
 * Pension and stocks/shares grow at a nominal equity rate; cash grows at a
 * separate, lower rate — never the equity rate. Monthly contributions go to
 * investments (stocks/shares) only — pension and cash grow from their starting
 * balance alone in this simple model. Compounded monthly to a target age.
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
  /** monthly contribution to invested assets (stocks/shares) */
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

/** Today, at the target age, contributed, and grown — for a single pot. */
export type PotBreakdown = {
  today: number
  future: number
  contributions: number
  /** future − today − contributions */
  growth: number
}

export type ForecastResult = {
  assumptions: Assumptions
  monthsToTarget: number
  targetAge: number
  /** sum of all assets held today */
  todayTotal: number
  /** projected total at the target age */
  projectedTotal: number
  pension: PotBreakdown
  /** stocks & shares / other investments */
  stocks: PotBreakdown
  cash: PotBreakdown
  /** starting balances + every contribution made */
  whatYouPutIn: number
  /** projected total − what you put in */
  marketAdds: number
  /** total contributions over the period */
  totalContributions: number
  scenarios: Scenario[]
  /** years from now the market first adds more in a year than you contribute; null if never within the horizon */
  crossoverYear: number | null
  yearly: YearPoint[]
}

/** One pot's position at a single year mark. */
export type PotYearPoint = {
  startValue: number
  contribution: number
  growth: number
  endValue: number
}

export type YearPoint = {
  /** years from now; 0 = today */
  year: number
  age: number
  pension: PotYearPoint
  stocks: PotYearPoint
  cash: PotYearPoint
  total: PotYearPoint
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

function breakdownFor(
  today: number,
  monthlyContribution: number,
  rate: number,
  months: number,
): PotBreakdown {
  const m = monthlyRate(rate)
  const future =
    futureValueLump(today, m, months) +
    futureValueContributions(monthlyContribution, m, months)
  const contributions = monthlyContribution * months
  return { today, future, contributions, growth: future - today - contributions }
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

/**
 * Year-by-year projection, split by pot. Whole years from today (year 0) to the
 * target age. Pension and cash grow from their starting balance only; the monthly
 * contribution applies to stocks/investments. Growth for a year is derived the same
 * way throughout this codebase: endValue − startValue − contribution.
 */
export function projectYearly(
  input: ForecastInput,
  a: Assumptions = DEFAULT_ASSUMPTIONS,
): YearPoint[] {
  const pensionToday = clampMoney(input.pension)
  const stocksToday = clampMoney(input.stocks)
  const cashToday = clampMoney(input.cash)
  const monthly = clampMoney(input.monthly)
  const years = Math.max(0, Math.round(a.targetAge - input.age))
  const mInv = monthlyRate(a.investedRate)
  const mCash = monthlyRate(a.cashRate)

  const zero = (v: number): PotYearPoint => ({
    startValue: v,
    contribution: 0,
    growth: 0,
    endValue: v,
  })

  const points: YearPoint[] = [
    {
      year: 0,
      age: input.age,
      pension: zero(pensionToday),
      stocks: zero(stocksToday),
      cash: zero(cashToday),
      total: zero(pensionToday + stocksToday + cashToday),
    },
  ]

  let prevPension = pensionToday
  let prevStocks = stocksToday
  let prevCash = cashToday

  for (let y = 1; y <= years; y++) {
    const monthsElapsed = y * 12
    const pensionEnd = futureValueLump(pensionToday, mInv, monthsElapsed)
    const stocksEnd =
      futureValueLump(stocksToday, mInv, monthsElapsed) +
      futureValueContributions(monthly, mInv, monthsElapsed)
    const cashEnd = futureValueLump(cashToday, mCash, monthsElapsed)
    const stocksContribution = monthly * 12

    const pensionGrowth = pensionEnd - prevPension
    const stocksGrowth = stocksEnd - prevStocks - stocksContribution
    const cashGrowth = cashEnd - prevCash

    points.push({
      year: y,
      age: input.age + y,
      pension: {
        startValue: prevPension,
        contribution: 0,
        growth: pensionGrowth,
        endValue: pensionEnd,
      },
      stocks: {
        startValue: prevStocks,
        contribution: stocksContribution,
        growth: stocksGrowth,
        endValue: stocksEnd,
      },
      cash: { startValue: prevCash, contribution: 0, growth: cashGrowth, endValue: cashEnd },
      total: {
        startValue: prevPension + prevStocks + prevCash,
        contribution: stocksContribution,
        growth: pensionGrowth + stocksGrowth + cashGrowth,
        endValue: pensionEnd + stocksEnd + cashEnd,
      },
    })

    prevPension = pensionEnd
    prevStocks = stocksEnd
    prevCash = cashEnd
  }

  return points
}

/**
 * The first year the market adds more than you contribute that year — the point
 * contributions become the minor part of the story. Null if it never happens
 * within the horizon (e.g. nothing invested, or contributions dwarf a tiny pot).
 */
export function findCrossoverYear(yearly: YearPoint[]): number | null {
  for (const p of yearly) {
    if (p.year >= 1 && p.total.growth > p.total.contribution) return p.year
  }
  return null
}

/** Full forecast for the results screen. */
export function forecast(
  input: ForecastInput,
  a: Assumptions = DEFAULT_ASSUMPTIONS,
): ForecastResult {
  const monthly = clampMoney(input.monthly)
  const months = monthsToTarget(input.age, a.targetAge)

  const pension = breakdownFor(clampMoney(input.pension), 0, a.investedRate, months)
  const stocks = breakdownFor(clampMoney(input.stocks), monthly, a.investedRate, months)
  const cash = breakdownFor(clampMoney(input.cash), 0, a.cashRate, months)

  const todayTotal = pension.today + stocks.today + cash.today
  const projectedTotal = pension.future + stocks.future + cash.future
  const totalContributions = pension.contributions + stocks.contributions + cash.contributions
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

  const yearly = projectYearly(input, a)

  return {
    assumptions: a,
    monthsToTarget: months,
    targetAge: a.targetAge,
    todayTotal,
    projectedTotal,
    pension,
    stocks,
    cash,
    whatYouPutIn,
    marketAdds,
    totalContributions,
    scenarios,
    crossoverYear: findCrossoverYear(yearly),
    yearly,
  }
}
