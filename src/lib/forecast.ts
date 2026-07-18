/**
 * Forecast — the whole-picture projection (pure, typed, unit-tested).
 *
 * Pension and stocks/shares grow at a nominal equity rate; cash grows at a
 * separate, lower rate — never the equity rate. Monthly contributions to
 * investments come from what's entered directly. Pension contributions come from
 * whichever of these is available, in order: a manually-entered monthly pension
 * contribution; failing that, a typical employer + personal split assumed against
 * an entered income; failing that, nothing — pension then grows from today's
 * balance alone, which the UI must flag clearly rather than let pass silently.
 * Compounded monthly to a target age.
 *
 * Nominal (not inflation-adjusted); the rates are stated openly on /methodology.
 * No comparison to anyone — this only shows the consequences of your own numbers.
 */
import {
  CASH_RATE,
  DEFAULT_EMPLOYER_PENSION_PCT,
  DEFAULT_PERSONAL_PENSION_PCT,
  INVESTED_RATE,
  TARGET_AGE,
} from '@/config'

export type ForecastInput = {
  age: number
  pension: number
  stocks: number
  cash: number
  /** monthly contribution to invested assets (stocks/shares) */
  monthly: number
  /** manually-entered monthly contribution to pension, if given */
  pensionMonthly?: number
  /** annual income (salary) — used only to estimate a pension contribution when
   *  pensionMonthly isn't given; never used for advice or comparison */
  income?: number
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

/**
 * How the pension's monthly contribution was decided:
 *  - 'manual'  — entered directly; always wins when present.
 *  - 'assumed' — no manual entry, but an income was given, so a typical
 *                employer + personal split is estimated (and must be shown as such).
 *  - 'none'    — neither given; pension grows from today's balance only, and the
 *                UI must surface this plainly, not bury it.
 */
export type PensionContributionBasis = 'manual' | 'assumed' | 'none'

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
  /** the monthly pension contribution actually used in this forecast */
  pensionMonthlyUsed: number
  pensionContributionBasis: PensionContributionBasis
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

/**
 * Decide the pension's monthly contribution: a manual entry always wins; failing
 * that, an entered income implies a typical employer + personal split; failing
 * that, there is none, and the caller must surface that plainly.
 */
export function resolvePensionMonthly(input: ForecastInput): {
  monthly: number
  basis: PensionContributionBasis
} {
  const manual = clampMoney(input.pensionMonthly ?? 0)
  if (manual > 0) return { monthly: manual, basis: 'manual' }

  const income = clampMoney(input.income ?? 0)
  if (income > 0) {
    const monthly =
      (income * (DEFAULT_EMPLOYER_PENSION_PCT + DEFAULT_PERSONAL_PENSION_PCT)) / 12
    return { monthly, basis: 'assumed' }
  }

  return { monthly: 0, basis: 'none' }
}

/** Projected total at the target age for a given monthly investment contribution. */
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
  const { monthly: pensionMonthly } = resolvePensionMonthly(input)

  const pensionFuture =
    futureValueLump(pension, mInv, months) +
    futureValueContributions(pensionMonthly, mInv, months)
  const stocksFuture =
    futureValueLump(stocks, mInv, months) +
    futureValueContributions(clampMoney(monthly), mInv, months)
  const cashFuture = futureValueLump(cash, mCash, months)
  return pensionFuture + stocksFuture + cashFuture
}

const SCENARIO_META: { key: ScenarioKey; label: string; delta: number | 'stop' }[] = [
  { key: 'stop', label: 'Stop contributing today', delta: 'stop' },
  { key: 'carryOn', label: 'Carry on as you are', delta: 0 },
  { key: 'add100', label: 'Add £100 a month', delta: 100 },
  { key: 'add500', label: 'Add £500 a month', delta: 500 },
]

/**
 * Year-by-year projection, split by pot. Whole years from today (year 0) to the
 * target age. Cash grows from its starting balance only. Pension and stocks each
 * grow from their starting balance plus their own resolved monthly contribution
 * (see resolvePensionMonthly for how pension's is decided). Growth for a year is
 * derived the same way throughout this codebase: endValue − startValue − contribution.
 */
export function projectYearly(
  input: ForecastInput,
  a: Assumptions = DEFAULT_ASSUMPTIONS,
): YearPoint[] {
  const pensionToday = clampMoney(input.pension)
  const stocksToday = clampMoney(input.stocks)
  const cashToday = clampMoney(input.cash)
  const stocksMonthly = clampMoney(input.monthly)
  const { monthly: pensionMonthly } = resolvePensionMonthly(input)
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
    const pensionEnd =
      futureValueLump(pensionToday, mInv, monthsElapsed) +
      futureValueContributions(pensionMonthly, mInv, monthsElapsed)
    const stocksEnd =
      futureValueLump(stocksToday, mInv, monthsElapsed) +
      futureValueContributions(stocksMonthly, mInv, monthsElapsed)
    const cashEnd = futureValueLump(cashToday, mCash, monthsElapsed)
    const pensionContribution = pensionMonthly * 12
    const stocksContribution = stocksMonthly * 12

    const pensionGrowth = pensionEnd - prevPension - pensionContribution
    const stocksGrowth = stocksEnd - prevStocks - stocksContribution
    const cashGrowth = cashEnd - prevCash

    points.push({
      year: y,
      age: input.age + y,
      pension: {
        startValue: prevPension,
        contribution: pensionContribution,
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
        contribution: pensionContribution + stocksContribution,
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
  const stocksMonthly = clampMoney(input.monthly)
  const months = monthsToTarget(input.age, a.targetAge)
  const { monthly: pensionMonthly, basis: pensionContributionBasis } =
    resolvePensionMonthly(input)

  const pension = breakdownFor(
    clampMoney(input.pension),
    pensionMonthly,
    a.investedRate,
    months,
  )
  const stocks = breakdownFor(clampMoney(input.stocks), stocksMonthly, a.investedRate, months)
  const cash = breakdownFor(clampMoney(input.cash), 0, a.cashRate, months)

  const todayTotal = pension.today + stocks.today + cash.today
  const projectedTotal = pension.future + stocks.future + cash.future
  const totalContributions = pension.contributions + stocks.contributions + cash.contributions
  const whatYouPutIn = todayTotal + totalContributions
  const marketAdds = projectedTotal - whatYouPutIn

  const scenarios: Scenario[] = SCENARIO_META.map((s) => {
    const scenarioMonthly = s.delta === 'stop' ? 0 : stocksMonthly + s.delta
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
    pensionMonthlyUsed: pensionMonthly,
    pensionContributionBasis,
  }
}
