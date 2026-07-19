/**
 * The live, editable Plan table's projection engine (pure, no IO). Unlike
 * forecast.ts's projectYearly — a flat-monthly-forever, closed-form
 * shortcut used by the free tool and the frozen Year-by-year baseline — this
 * layers a schedule of future contribution changes and one-off planned
 * events on top, so it has to walk forward one year at a time instead of
 * re-deriving each year straight from year 0. Deliberately a separate
 * module: forecast.ts stays untouched and unaffected by any of this.
 */
import { futureValueContributions, futureValueLump, monthlyRate } from './forecast.js'
import type { AccountOwner } from './accountOwner.js'
import type { OwnerFilter, PotCategory } from './householdForecast.js'

const POT_CATEGORIES: readonly PotCategory[] = ['pension', 'investments', 'cash']

export type ContributionChangeType = 'set' | 'grow_pct'

export type ContributionChange = {
  potCategory: PotCategory
  effectiveYear: number
  changeType: ContributionChangeType
  /** 'set': new flat £/month from effectiveYear onward. 'grow_pct': fractional
   *  annual growth (0.01 = 1%), compounding every year from effectiveYear
   *  onward — not a one-time bump — until a later change supersedes it. */
  value: number
}

export type PlannedEvent = {
  potCategory: PotCategory
  year: number
  /** positive = money in, negative = money out */
  amount: number
}

type ScheduleMode =
  | { kind: 'flat'; value: number }
  | { kind: 'growing'; pct: number; anchorYear: number; anchorValue: number }

/**
 * Resolves the effective monthly contribution for every calendar year in
 * [startYear, endYear], given a base monthly figure and this pot's ordered
 * list of future changes. Never negative — a 'set' to a negative figure or a
 * 'grow_pct' shrinking below zero both clamp to 0.
 */
export function resolveMonthlySchedule(
  baseMonthly: number,
  changes: ContributionChange[],
  startYear: number,
  endYear: number,
): Map<number, number> {
  const sorted = [...changes].sort((a, b) => a.effectiveYear - b.effectiveYear)
  const schedule = new Map<number, number>()
  let mode: ScheduleMode = { kind: 'flat', value: baseMonthly }
  let idx = 0

  const valueAt = (year: number): number =>
    mode.kind === 'flat' ? mode.value : mode.anchorValue * Math.pow(1 + mode.pct, year - mode.anchorYear)

  for (let year = startYear; year <= endYear; year++) {
    while (idx < sorted.length && sorted[idx]!.effectiveYear <= year) {
      const change = sorted[idx]!
      const valueBeforeChange = valueAt(year)
      mode =
        change.changeType === 'set'
          ? { kind: 'flat', value: change.value }
          : {
              kind: 'growing',
              pct: change.value,
              // anchored one year early so the growth is already applied in
              // the effective year itself, matching 'set' taking effect
              // immediately rather than the year after
              anchorYear: change.effectiveYear - 1,
              anchorValue: valueBeforeChange,
            }
      idx++
    }
    schedule.set(year, Math.max(0, valueAt(year)))
  }
  return schedule
}

export type ScheduledPotYearPoint = {
  startValue: number
  contribution: number
  /** net planned-event delta this year — separate from growth and
   *  contributions, same reasoning as account_snapshots' money_in/transfer_out
   *  never being folded into a growth figure */
  events: number
  growth: number
  endValue: number
}

export type ScheduledYearPoint = {
  calendarYear: number
  age: number
  pension: ScheduledPotYearPoint
  investments: ScheduledPotYearPoint
  cash: ScheduledPotYearPoint
  total: ScheduledPotYearPoint
}

export type ScheduledPlanInput = {
  startYear: number
  age: number
  targetAge: number
  pots: Record<PotCategory, { balance: number; rate: number; baseMonthly: number }>
  changes: ContributionChange[]
  events: PlannedEvent[]
}

function eventsFor(events: PlannedEvent[], pot: PotCategory, calendarYear: number): number {
  return events
    .filter((e) => e.potCategory === pot && e.year === calendarYear)
    .reduce((sum, e) => sum + e.amount, 0)
}

/**
 * Year-by-year projection with a live contribution schedule and planned
 * events layered on top, one pot at a time, then combined into a total.
 * Each year's growth is the market's share only — endBeforeEvents − start −
 * contribution — matching this codebase's rule everywhere else that a
 * non-growth cash movement is never folded into a growth figure.
 */
export function projectScheduledYearly(input: ScheduledPlanInput): ScheduledYearPoint[] {
  const years = Math.max(0, Math.round(input.targetAge - input.age))
  const endYear = input.startYear + years

  const schedules = Object.fromEntries(
    POT_CATEGORIES.map((pot) => [
      pot,
      resolveMonthlySchedule(
        input.pots[pot].baseMonthly,
        input.changes.filter((c) => c.potCategory === pot),
        input.startYear,
        endYear,
      ),
    ]),
  ) as Record<PotCategory, Map<number, number>>

  const balances = Object.fromEntries(
    POT_CATEGORIES.map((pot) => [pot, Math.max(0, input.pots[pot].balance)]),
  ) as Record<PotCategory, number>

  const zero = (v: number): ScheduledPotYearPoint => ({
    startValue: v,
    contribution: 0,
    events: 0,
    growth: 0,
    endValue: v,
  })

  const points: ScheduledYearPoint[] = [
    {
      calendarYear: input.startYear,
      age: input.age,
      pension: zero(balances.pension),
      investments: zero(balances.investments),
      cash: zero(balances.cash),
      total: zero(balances.pension + balances.investments + balances.cash),
    },
  ]

  for (let y = 1; y <= years; y++) {
    const calendarYear = input.startYear + y
    const potPoints: Partial<Record<PotCategory, ScheduledPotYearPoint>> = {}

    for (const pot of POT_CATEGORIES) {
      const start = balances[pot]
      const monthly = schedules[pot].get(calendarYear) ?? 0
      const m = monthlyRate(input.pots[pot].rate)
      const beforeEvents = futureValueLump(start, m, 12) + futureValueContributions(monthly, m, 12)
      const contribution = monthly * 12
      const eventDelta = eventsFor(input.events, pot, calendarYear)
      const end = Math.max(0, beforeEvents + eventDelta)

      potPoints[pot] = {
        startValue: start,
        contribution,
        events: eventDelta,
        growth: beforeEvents - start - contribution,
        endValue: end,
      }
      balances[pot] = end
    }

    const pension = potPoints.pension!
    const investments = potPoints.investments!
    const cash = potPoints.cash!
    points.push({
      calendarYear,
      age: input.age + y,
      pension,
      investments,
      cash,
      total: {
        startValue: pension.startValue + investments.startValue + cash.startValue,
        contribution: pension.contribution + investments.contribution + cash.contribution,
        events: pension.events + investments.events + cash.events,
        growth: pension.growth + investments.growth + cash.growth,
        endValue: pension.endValue + investments.endValue + cash.endValue,
      },
    })
  }

  return points
}

export type ScheduledPlanAccount = {
  owner: AccountOwner
  potCategory: PotCategory
  monthlyContribution: number
  currentBalance: number | null
}

export type OwnerScopedContributionChange = ContributionChange & { owner: AccountOwner }
export type OwnerScopedPlannedEvent = PlannedEvent & { owner: AccountOwner }

function resolveOwnerAge(owner: OwnerFilter, people: { age: number }[]): number | null {
  if (owner === 'person_a') return people[0]?.age ?? null
  if (owner === 'person_b') return people[1]?.age ?? null
  // 'total' and 'joint' both anchor to the younger person's age, matching
  // aggregateHouseholdState's convention — joint accounts have no person of
  // their own, and 'total' runs to the later person's retirement, not the
  // sooner one's
  return people.length > 0 ? Math.min(...people.map((p) => p.age)) : null
}

/**
 * Resolves live household + accounts + schedule state into one owner's
 * scheduled projection — the Plan table's data source. Unlike
 * aggregateHouseholdState, this reads current live data every time (no
 * frozen snapshot): the Plan table is a working "what if" view, not a
 * commitment record.
 */
export function buildScheduledPlan(params: {
  owner: OwnerFilter
  startYear: number
  people: { age: number }[]
  household: { retirementAge: number; realReturn: number; cashReturn: number }
  accounts: ScheduledPlanAccount[]
  changes: OwnerScopedContributionChange[]
  events: OwnerScopedPlannedEvent[]
}): ScheduledYearPoint[] | null {
  const age = resolveOwnerAge(params.owner, params.people)
  if (age === null) return null

  const accounts =
    params.owner === 'total' ? params.accounts : params.accounts.filter((a) => a.owner === params.owner)
  const changes =
    params.owner === 'total' ? params.changes : params.changes.filter((c) => c.owner === params.owner)
  const events = params.owner === 'total' ? params.events : params.events.filter((e) => e.owner === params.owner)

  const sumBalance = (pot: PotCategory) =>
    accounts.filter((a) => a.potCategory === pot).reduce((s, a) => s + (a.currentBalance ?? 0), 0)
  const sumMonthly = (pot: PotCategory) =>
    accounts.filter((a) => a.potCategory === pot).reduce((s, a) => s + a.monthlyContribution, 0)
  const rateFor = (pot: PotCategory) => (pot === 'cash' ? params.household.cashReturn : params.household.realReturn)

  const pots = Object.fromEntries(
    POT_CATEGORIES.map((pot) => [
      pot,
      { balance: sumBalance(pot), rate: rateFor(pot), baseMonthly: sumMonthly(pot) },
    ]),
  ) as ScheduledPlanInput['pots']

  return projectScheduledYearly({
    startYear: params.startYear,
    age,
    targetAge: params.household.retirementAge,
    pots,
    changes: changes.map((c) => ({
      potCategory: c.potCategory,
      effectiveYear: c.effectiveYear,
      changeType: c.changeType,
      value: c.value,
    })),
    events: events.map((e) => ({ potCategory: e.potCategory, year: e.year, amount: e.amount })),
  })
}
