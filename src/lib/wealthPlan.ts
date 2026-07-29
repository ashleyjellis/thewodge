/**
 * Wealth plan — the four-pot forecast behind /wealth-planning-tool: pension, ISA
 * stocks & shares, ISA cash and cash savings, projected separately and combined.
 *
 * Pension and ISA stocks & shares grow at the invested rate; ISA cash and cash
 * savings grow at the (lower) cash rate — the same two rates used everywhere else
 * on the site, just applied to four named pots instead of three. Pension's monthly
 * contribution is always salary × the given percentage ÷ 12 — there's no "assumed"
 * fallback here, because the percentage is asked for directly.
 *
 * An expected annual bonus, if given, is added once a year — at year-end, so it
 * doesn't earn growth in the year it lands — to whichever single pot it's aimed at.
 *
 * Either rate can be overridden for individual years (rateOverrides) — the
 * year-by-year table lets someone say "I think growth slows in year 12" without
 * changing the assumption for every other year. An override only affects its own
 * year's rate; the balance effect still carries forward through ordinary
 * compounding, exactly like a real rate change would.
 *
 * Reuses forecast.ts's compounding primitives rather than duplicating them, but
 * keeps its own input/result shapes: this page's four named pots don't fit the
 * three-pot ForecastInput/ForecastResult used by the free calculator and /results,
 * and forecast.ts stays untouched so nothing there can regress.
 */
import {
  clampMoney,
  futureValueContributions,
  futureValueLump,
  monthlyRate,
  monthsToTarget,
  DEFAULT_ASSUMPTIONS,
} from './forecast'
import type { Assumptions, PotBreakdown, PotYearPoint } from './forecast'

export type PotKey = 'pension' | 'isaStocks' | 'isaCash' | 'cashSavings'

/** A manual rate override for one specific year (1 = the first projected year).
 *  Leaving a field out means that rate keeps using the assumption for that year. */
export type RateOverride = {
  year: number
  investedRate?: number
  cashRate?: number
}

export const POT_KEYS: PotKey[] = ['pension', 'isaStocks', 'isaCash', 'cashSavings']

export const POT_LABELS: Record<PotKey, string> = {
  pension: 'Pension',
  isaStocks: 'ISA — stocks & shares',
  isaCash: 'ISA — cash',
  cashSavings: 'Cash savings',
}

export type WealthPlanInput = {
  age: number
  targetAge: number
  /** annual salary — used only to derive the pension contribution; never for advice or comparison */
  salary: number
  /** fraction, e.g. 0.05 for 5% */
  pensionPct: number
  pension: number
  isaStocks: number
  isaCash: number
  cashSavings: number
  isaStocksMonthly: number
  isaCashMonthly: number
  cashSavingsMonthly: number
  /** expected annual bonus contribution, added once a year to bonusTarget */
  bonus: number
  bonusTarget: PotKey
  /** per-year manual rate tweaks — see RateOverride */
  rateOverrides?: RateOverride[]
}

export type WealthPlanYearPoint = {
  /** years from now; 0 = today */
  year: number
  age: number
  pots: Record<PotKey, PotYearPoint>
  total: PotYearPoint
}

export type WealthPlanResult = {
  assumptions: Assumptions
  targetAge: number
  monthsToTarget: number
  todayTotal: number
  projectedTotal: number
  pots: Record<PotKey, PotBreakdown>
  /** starting balances + every contribution made, across all four pots */
  whatYouPutIn: number
  /** projected total − what you put in */
  marketAdds: number
  totalContributions: number
  yearly: WealthPlanYearPoint[]
  /** years from now the market first adds more in a year than you contribute; null if never within the horizon */
  crossoverYear: number | null
  /** the monthly pension contribution this forecast used: salary × pensionPct ÷ 12 */
  pensionMonthly: number
}

const zeroPoint = (v: number): PotYearPoint => ({
  startValue: v,
  contribution: 0,
  growth: 0,
  endValue: v,
})

/**
 * One pot's full year-by-year path: a level monthly contribution, compounded a
 * year at a time, with an optional lump sum (the bonus) added at the end of every
 * year. Chaining whole-year compounding this way lands on the same totals as
 * forecast.ts's closed-form projection when annualLump is 0 — this file only
 * iterates because the bonus needs a year boundary to land on.
 */
function projectPotYearly(
  today: number,
  monthly: number,
  rateForYear: (year: number) => number,
  years: number,
  annualLump: number,
): PotYearPoint[] {
  const points: PotYearPoint[] = [zeroPoint(today)]
  let balance = today
  for (let y = 1; y <= years; y++) {
    const start = balance
    const m = monthlyRate(rateForYear(y))
    const grownBeforeLump =
      futureValueLump(start, m, 12) + futureValueContributions(monthly, m, 12)
    const contribution = monthly * 12 + annualLump
    const endValue = grownBeforeLump + annualLump
    points.push({
      startValue: start,
      contribution,
      growth: endValue - start - contribution,
      endValue,
    })
    balance = endValue
  }
  return points
}

/** The first year the market adds more than was put in that year — the same rule
 *  as forecast.ts's findCrossoverYear, applied to this file's own point shape. */
function findCrossoverYear(yearly: WealthPlanYearPoint[]): number | null {
  for (const p of yearly) {
    if (p.year >= 1 && p.total.growth > p.total.contribution) return p.year
  }
  return null
}

function potBreakdown(today: number, yearly: PotYearPoint[]): PotBreakdown {
  const last = yearly[yearly.length - 1]!
  const contributions = yearly.reduce((s, p) => s + p.contribution, 0)
  return {
    today,
    future: last.endValue,
    contributions,
    growth: last.endValue - today - contributions,
  }
}

/** Full forecast for the wealth planning tool's results screen. */
export function projectWealthPlan(
  input: WealthPlanInput,
  a: Assumptions = DEFAULT_ASSUMPTIONS,
): WealthPlanResult {
  const years = Math.max(0, Math.round(input.targetAge - input.age))
  const months = monthsToTarget(input.age, input.targetAge)
  const pensionMonthly = clampMoney(
    (clampMoney(input.salary) * clampMoney(input.pensionPct)) / 12,
  )

  const pensionToday = clampMoney(input.pension)
  const isaStocksToday = clampMoney(input.isaStocks)
  const isaCashToday = clampMoney(input.isaCash)
  const cashSavingsToday = clampMoney(input.cashSavings)

  const isaStocksMonthly = clampMoney(input.isaStocksMonthly)
  const isaCashMonthly = clampMoney(input.isaCashMonthly)
  const cashSavingsMonthly = clampMoney(input.cashSavingsMonthly)

  const bonusAnnual = clampMoney(input.bonus)
  const bonusFor = (key: PotKey) => (input.bonusTarget === key ? bonusAnnual : 0)

  const overridesByYear = new Map<number, RateOverride>()
  for (const o of input.rateOverrides ?? []) overridesByYear.set(o.year, o)
  const investedRateForYear = (y: number) => overridesByYear.get(y)?.investedRate ?? a.investedRate
  const cashRateForYear = (y: number) => overridesByYear.get(y)?.cashRate ?? a.cashRate

  const pensionYearly = projectPotYearly(
    pensionToday,
    pensionMonthly,
    investedRateForYear,
    years,
    bonusFor('pension'),
  )
  const isaStocksYearly = projectPotYearly(
    isaStocksToday,
    isaStocksMonthly,
    investedRateForYear,
    years,
    bonusFor('isaStocks'),
  )
  const isaCashYearly = projectPotYearly(
    isaCashToday,
    isaCashMonthly,
    cashRateForYear,
    years,
    bonusFor('isaCash'),
  )
  const cashSavingsYearly = projectPotYearly(
    cashSavingsToday,
    cashSavingsMonthly,
    cashRateForYear,
    years,
    bonusFor('cashSavings'),
  )

  const yearly: WealthPlanYearPoint[] = []
  for (let i = 0; i <= years; i++) {
    const pots: Record<PotKey, PotYearPoint> = {
      pension: pensionYearly[i]!,
      isaStocks: isaStocksYearly[i]!,
      isaCash: isaCashYearly[i]!,
      cashSavings: cashSavingsYearly[i]!,
    }
    const total: PotYearPoint = {
      startValue:
        pots.pension.startValue +
        pots.isaStocks.startValue +
        pots.isaCash.startValue +
        pots.cashSavings.startValue,
      contribution:
        pots.pension.contribution +
        pots.isaStocks.contribution +
        pots.isaCash.contribution +
        pots.cashSavings.contribution,
      growth:
        pots.pension.growth +
        pots.isaStocks.growth +
        pots.isaCash.growth +
        pots.cashSavings.growth,
      endValue:
        pots.pension.endValue +
        pots.isaStocks.endValue +
        pots.isaCash.endValue +
        pots.cashSavings.endValue,
    }
    yearly.push({ year: i, age: input.age + i, pots, total })
  }

  const pots: Record<PotKey, PotBreakdown> = {
    pension: potBreakdown(pensionToday, pensionYearly),
    isaStocks: potBreakdown(isaStocksToday, isaStocksYearly),
    isaCash: potBreakdown(isaCashToday, isaCashYearly),
    cashSavings: potBreakdown(cashSavingsToday, cashSavingsYearly),
  }

  const todayTotal = pensionToday + isaStocksToday + isaCashToday + cashSavingsToday
  const projectedTotal =
    pots.pension.future + pots.isaStocks.future + pots.isaCash.future + pots.cashSavings.future
  const totalContributions =
    pots.pension.contributions +
    pots.isaStocks.contributions +
    pots.isaCash.contributions +
    pots.cashSavings.contributions
  const whatYouPutIn = todayTotal + totalContributions
  const marketAdds = projectedTotal - whatYouPutIn

  return {
    assumptions: a,
    targetAge: input.targetAge,
    monthsToTarget: months,
    todayTotal,
    projectedTotal,
    pots,
    whatYouPutIn,
    marketAdds,
    totalContributions,
    yearly,
    crossoverYear: findCrossoverYear(yearly),
    pensionMonthly,
  }
}
