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
import type { PotCategory } from './householdForecast.js'

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
