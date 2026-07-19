/**
 * Household-level forecast (spec §4). Aggregates the multi-person,
 * multi-account Accounts-tab data into the single-input shape the free tool's
 * forecast engine (src/lib/forecast.ts) already expects, so this reuses that
 * engine rather than building a second, divergent one. Pure — no IO.
 *
 * Pension and investment monthly contributions come straight from the real
 * per-account monthly_contribution figures set on the Accounts tab — never
 * estimated from income the way the free tool has to, since real data exists
 * here.
 */
import type { Assumptions, ForecastInput, YearPoint } from './forecast'
import { latestSnapshotByAccount } from './snapshotMath'

export type PotCategory = 'pension' | 'investments' | 'cash'

/**
 * The frozen shape stored in forecast_snapshots.household_state_json — maps
 * 1:1 onto ForecastInput + Assumptions so a baseline/replan can be replayed
 * through the exact same engine later, with nothing re-derived from
 * since-changed account data (spec §4: "it does not recompute from live
 * account data").
 */
export type FrozenForecastState = {
  age: number
  targetAge: number
  pension: number
  stocks: number
  cash: number
  monthly: number
  pensionMonthly: number
  investedRate: number
  cashRate: number
}

export function frozenStateToForecastInput(
  state: FrozenForecastState,
): { input: ForecastInput; assumptions: Assumptions } {
  return {
    input: {
      age: state.age,
      pension: state.pension,
      stocks: state.stocks,
      cash: state.cash,
      monthly: state.monthly,
      pensionMonthly: state.pensionMonthly,
    },
    assumptions: {
      investedRate: state.investedRate,
      cashRate: state.cashRate,
      targetAge: state.targetAge,
    },
  }
}

export type AggregatableHousehold = { retirementAge: number; realReturn: number; cashReturn: number }
export type AggregatablePerson = { age: number }
export type AggregatableAccount = {
  potCategory: PotCategory
  monthlyContribution: number
  currentBalance: number | null
}

/**
 * Whether there's enough set up to produce a meaningful forecast — no people
 * or no accounts means nothing to project.
 */
export function canForecast(people: AggregatablePerson[], accounts: AggregatableAccount[]): boolean {
  return people.length > 0 && accounts.length > 0
}

/**
 * Aggregates live household state into the forecast engine's input shape.
 * The anchor age is the YOUNGER person's — the household's horizon runs until
 * the LATER of the two reaches the shared target retirement age, matching
 * the whole-picture principle rather than truncating the projection at
 * whoever gets there first.
 */
export function aggregateHouseholdState(
  household: AggregatableHousehold,
  people: AggregatablePerson[],
  accounts: AggregatableAccount[],
): FrozenForecastState {
  const anchorAge = Math.min(...people.map((p) => p.age))
  const sumBalance = (pot: PotCategory) =>
    accounts.filter((a) => a.potCategory === pot).reduce((s, a) => s + (a.currentBalance ?? 0), 0)
  const sumMonthly = (pot: PotCategory) =>
    accounts.filter((a) => a.potCategory === pot).reduce((s, a) => s + a.monthlyContribution, 0)

  return {
    age: anchorAge,
    targetAge: household.retirementAge,
    pension: sumBalance('pension'),
    stocks: sumBalance('investments'),
    cash: sumBalance('cash'),
    monthly: sumMonthly('investments'),
    pensionMonthly: sumMonthly('pension'),
    investedRate: household.realReturn,
    cashRate: household.cashReturn,
  }
}

/** Re-indexes a projection's "years from creation" onto real calendar years. */
export function yearlyByCalendarYear(yearly: YearPoint[], createdAt: string): Map<number, YearPoint> {
  const startYear = new Date(createdAt).getUTCFullYear()
  const map = new Map<number, YearPoint>()
  for (const p of yearly) {
    map.set(startYear + p.year, p)
  }
  return map
}

/**
 * Real tracked total wealth as of the latest snapshot recorded during or
 * before `calendarYear`, for whichever accounts exist today — an account
 * with no snapshot that early simply hadn't been added yet, contributing 0
 * (spec §4: "actual end-of-year total, derived from the latest
 * account_snapshots in or before that year").
 */
export function actualTotalAsOf(
  accounts: { id: string }[],
  snapshots: { accountId: string; year: number; recordedAt: string; endBalance: number }[],
  calendarYear: number,
): number {
  const eligible = snapshots.filter((s) => s.year <= calendarYear)
  const latestByAccount = latestSnapshotByAccount(eligible)
  let total = 0
  for (const account of accounts) {
    const latest = latestByAccount.get(account.id)
    if (latest) total += latest.endBalance
  }
  return total
}

export type ForecastYearRow = {
  calendarYear: number
  age: number
  planTotal: number
  /** the ORIGINAL baseline's total for this year — only populated once it
   *  differs from the plan-of-record (i.e. after a replan), so the UI only
   *  renders the faded secondary line when it's actually relevant */
  originalTotal: number | null
  /** null for a calendar year that hasn't happened yet — no actual data to show */
  actualTotal: number | null
}

/**
 * Builds the year-by-year table rows: the current plan-of-record always,
 * the original baseline alongside it once a replan has happened (spec §4 —
 * "the fork must stay visible, never disappear"), and real tracked totals
 * for whichever calendar years have already occurred.
 */
export function buildForecastYearRows(params: {
  planYearly: YearPoint[]
  planCreatedAt: string
  originalYearly: YearPoint[] | null
  originalCreatedAt: string | null
  hasReplanned: boolean
  accounts: { id: string }[]
  snapshots: { accountId: string; year: number; recordedAt: string; endBalance: number }[]
  currentCalendarYear: number
}): ForecastYearRow[] {
  const planByYear = yearlyByCalendarYear(params.planYearly, params.planCreatedAt)
  const originalByYear =
    params.hasReplanned && params.originalYearly && params.originalCreatedAt
      ? yearlyByCalendarYear(params.originalYearly, params.originalCreatedAt)
      : new Map<number, YearPoint>()

  return [...planByYear.keys()]
    .sort((a, b) => a - b)
    .map((calendarYear) => {
      const planPoint = planByYear.get(calendarYear)!
      const originalPoint = originalByYear.get(calendarYear)
      return {
        calendarYear,
        age: planPoint.age,
        planTotal: planPoint.total.endValue,
        originalTotal: originalPoint ? originalPoint.total.endValue : null,
        actualTotal:
          calendarYear <= params.currentCalendarYear
            ? actualTotalAsOf(params.accounts, params.snapshots, calendarYear)
            : null,
      }
    })
}

/** Never "behind" — spec §4's deliberate anti-verdict phrasing. */
export function varianceLabel(actual: number, plan: number): string {
  return actual > plan ? 'ahead of plan' : 'tracking to a revised plan'
}
