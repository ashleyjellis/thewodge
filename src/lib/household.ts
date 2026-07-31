/**
 * Household aggregation for the wealth planning tool — combines each
 * person's own forecast (wealthPlan.ts's projectWealthPlan, completely
 * unmodified) into a single joint WealthPlanResult, so the existing results
 * components can render a household exactly like they render one person.
 *
 * People can have different ages and different "plan to" ages. The joint
 * forecast runs for as long as whichever person has the most years left;
 * once someone passes their own target age, their pots keep compounding at
 * the baseline rates with no further contributions rather than the whole
 * household forecast stopping at the first person's retirement — the same
 * choice already made for the paid household product (see
 * householdForecast.ts's householdTargetAge). Reimplemented here, not
 * imported: that file works off the app's stored account/person records,
 * this one off the free tool's own WealthPlanInput shape.
 */
import { DEFAULT_ASSUMPTIONS, futureValueLump, monthlyRate, monthsToTarget } from './forecast'
import type { Assumptions, PotBreakdown, PotYearPoint } from './forecast'
import { POT_KEYS, projectWealthPlan } from './wealthPlan'
import type { PotKey, WealthPlanInput, WealthPlanResult, WealthPlanYearPoint } from './wealthPlan'

export type Person = WealthPlanInput & { id: string; name: string }

function potRecord<T>(fn: (key: PotKey) => T): Record<PotKey, T> {
  return {
    pension: fn('pension'),
    isaStocks: fn('isaStocks'),
    isaCash: fn('isaCash'),
    cashSavings: fn('cashSavings'),
  }
}

function sumPots(points: PotYearPoint[]): PotYearPoint {
  return points.reduce(
    (s, p) => ({
      startValue: s.startValue + p.startValue,
      contribution: s.contribution + p.contribution,
      growth: s.growth + p.growth,
      endValue: s.endValue + p.endValue,
    }),
    { startValue: 0, contribution: 0, growth: 0, endValue: 0 },
  )
}

/**
 * One person's own yearly path, continued past their own target age out to
 * the household's shared horizon — no further contributions, growth only, at
 * the baseline rates (a person's own manual rate overrides never reach past
 * their own target age, since the table never shows those years for them). A
 * no-op for whichever person's own years already equal the horizon.
 */
function extendToHorizon(
  personAge: number,
  own: WealthPlanYearPoint[],
  years: number,
  a: Assumptions,
): WealthPlanYearPoint[] {
  const ownYears = own.length - 1
  if (ownYears >= years) return own

  const extended = own.slice()
  let prevPots = own[own.length - 1]!.pots
  for (let y = ownYears + 1; y <= years; y++) {
    const pots = potRecord((key) => {
      const rate = key === 'pension' || key === 'isaStocks' ? a.investedRate : a.cashRate
      const start = prevPots[key].endValue
      const endValue = futureValueLump(start, monthlyRate(rate), 12)
      return { startValue: start, contribution: 0, growth: endValue - start, endValue }
    })
    extended.push({
      year: y,
      age: personAge + y,
      pots,
      total: sumPots(POT_KEYS.map((k) => pots[k])),
    })
    prevPots = pots
  }
  return extended
}

function breakdown(today: number, yearlyForPot: PotYearPoint[]): PotBreakdown {
  const last = yearlyForPot[yearlyForPot.length - 1]!
  const contributions = yearlyForPot.reduce((s, p) => s + p.contribution, 0)
  return { today, future: last.endValue, contributions, growth: last.endValue - today - contributions }
}

/** Mirrors wealthPlan.ts's own (unexported) findCrossoverYear — same rule,
 *  applied to the joint yearly array. */
function findCrossoverYear(yearly: WealthPlanYearPoint[]): number | null {
  for (const p of yearly) {
    if (p.year >= 1 && p.total.growth > p.total.contribution) return p.year
  }
  return null
}

/**
 * Combines every person's own forecast into one household-wide result — the
 * exact same shape projectWealthPlan returns for one person, so it can be
 * handed to the same results components. Anchored to the YOUNGEST person's
 * age (matching householdForecast.ts's existing convention) purely for the
 * yearly table's "age" column; every person's own math still runs from their
 * own actual age and their own target age. Callers must pass at least one
 * person.
 */
export function aggregateHousehold(
  people: Person[],
  a: Assumptions = DEFAULT_ASSUMPTIONS,
): WealthPlanResult {
  const anchorAge = Math.min(...people.map((p) => p.age))
  const years = Math.max(...people.map((p) => Math.max(0, Math.round(p.targetAge - p.age))))
  const targetAge = anchorAge + years

  const perPerson = people.map((p) => ({ person: p, result: projectWealthPlan(p, a) }))
  const extended = perPerson.map(({ person, result }) =>
    extendToHorizon(person.age, result.yearly, years, a),
  )

  const yearly: WealthPlanYearPoint[] = []
  for (let y = 0; y <= years; y++) {
    const pots = potRecord((key) => sumPots(extended.map((e) => e[y]!.pots[key])))
    yearly.push({ year: y, age: anchorAge + y, pots, total: sumPots(POT_KEYS.map((k) => pots[k])) })
  }

  const pots = potRecord((key) => {
    const today = perPerson.reduce((s, { person }) => s + person[key], 0)
    return breakdown(
      today,
      yearly.map((y) => y.pots[key]),
    )
  })

  const todayTotal = perPerson.reduce((s, { result }) => s + result.todayTotal, 0)
  const projectedTotal = POT_KEYS.reduce((s, key) => s + pots[key].future, 0)
  const totalContributions = POT_KEYS.reduce((s, key) => s + pots[key].contributions, 0)
  const whatYouPutIn = todayTotal + totalContributions
  const marketAdds = projectedTotal - whatYouPutIn
  const pensionMonthly = perPerson.reduce((s, { result }) => s + result.pensionMonthly, 0)

  return {
    assumptions: a,
    targetAge,
    monthsToTarget: monthsToTarget(anchorAge, targetAge),
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
