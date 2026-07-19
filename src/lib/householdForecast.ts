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
import type { Assumptions, ForecastInput, PotYearPoint, YearPoint } from './forecast.js'
import { latestSnapshotByAccount, periodGrowth } from './snapshotMath.js'
import type { AccountOwner } from './accountOwner.js'

export type PotCategory = 'pension' | 'investments' | 'cash'

/** The table's pot filter — 'total' is the whole household, combined. */
export type PotFilter = PotCategory | 'total'

/** The page's owner filter — 'total' is the whole household, combined. */
export type OwnerFilter = 'total' | AccountOwner

export type PotTotals = {
  /** the age this slice's own projection is anchored to — see aggregateHouseholdState */
  age: number
  pension: number
  stocks: number
  cash: number
  monthly: number
  pensionMonthly: number
}

/**
 * The frozen shape stored in forecast_snapshots.household_state_json — one
 * slice per owner filter, each mapping 1:1 onto ForecastInput so a
 * baseline/replan can be replayed through the exact same engine later, with
 * nothing re-derived from since-changed account data (spec §4: "it does not
 * recompute from live account data"). personA/personB are null when that
 * person didn't exist yet at the time this was frozen.
 */
export type FrozenForecastState = {
  targetAge: number
  investedRate: number
  cashRate: number
  total: PotTotals
  personA: PotTotals | null
  personB: PotTotals | null
  /** joint accounts have no person of their own — anchored to the same age as `total` */
  joint: PotTotals
}

/** Picks one owner's slice and maps it onto the forecast engine's input shape. */
export function ownerStateToForecastInput(
  state: FrozenForecastState,
  owner: OwnerFilter,
): { input: ForecastInput; assumptions: Assumptions } | null {
  const totals =
    owner === 'total'
      ? state.total
      : owner === 'person_a'
        ? state.personA
        : owner === 'person_b'
          ? state.personB
          : state.joint
  if (!totals) return null
  return {
    input: {
      age: totals.age,
      pension: totals.pension,
      stocks: totals.stocks,
      cash: totals.cash,
      monthly: totals.monthly,
      pensionMonthly: totals.pensionMonthly,
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
  owner: AccountOwner
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

function potTotalsFor(accounts: AggregatableAccount[], age: number): PotTotals {
  const sumBalance = (pot: PotCategory) =>
    accounts.filter((a) => a.potCategory === pot).reduce((s, a) => s + (a.currentBalance ?? 0), 0)
  const sumMonthly = (pot: PotCategory) =>
    accounts.filter((a) => a.potCategory === pot).reduce((s, a) => s + a.monthlyContribution, 0)
  return {
    age,
    pension: sumBalance('pension'),
    stocks: sumBalance('investments'),
    cash: sumBalance('cash'),
    monthly: sumMonthly('investments'),
    pensionMonthly: sumMonthly('pension'),
  }
}

/**
 * Aggregates live household state into the forecast engine's input shape —
 * one slice per owner filter, so a person's own forecast can be projected
 * from their own age, not the household's shared anchor. The household-wide
 * ('total') anchor age is the YOUNGER person's — the household's horizon
 * runs until the LATER of the two reaches the shared target retirement age,
 * matching the whole-picture principle rather than truncating the
 * projection at whoever gets there first. `people[0]` is person_a,
 * `people[1]` is person_b, matching accountOwner.ts's convention.
 */
export function aggregateHouseholdState(
  household: AggregatableHousehold,
  people: AggregatablePerson[],
  accounts: AggregatableAccount[],
): FrozenForecastState {
  const anchorAge = Math.min(...people.map((p) => p.age))

  return {
    targetAge: household.retirementAge,
    investedRate: household.realReturn,
    cashRate: household.cashReturn,
    total: potTotalsFor(accounts, anchorAge),
    personA: people[0] ? potTotalsFor(accounts.filter((a) => a.owner === 'person_a'), people[0].age) : null,
    personB: people[1] ? potTotalsFor(accounts.filter((a) => a.owner === 'person_b'), people[1].age) : null,
    joint: potTotalsFor(accounts.filter((a) => a.owner === 'joint'), anchorAge),
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

/** Picks the pot's own start/contribution/growth/end out of a YearPoint. */
export function potPoint(point: YearPoint, pot: PotFilter): PotYearPoint {
  if (pot === 'pension') return point.pension
  if (pot === 'investments') return point.stocks
  if (pot === 'cash') return point.cash
  return point.total
}

function accountsInPot<A extends { potCategory: PotCategory }>(accounts: A[], pot: PotFilter): A[] {
  return pot === 'total' ? accounts : accounts.filter((a) => a.potCategory === pot)
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

export type ActualSnapshotLike = {
  accountId: string
  year: number
  recordedAt: string
  startBalance: number
  endBalance: number
  moneyIn: number | null
  transferOut: number | null
}

/**
 * Real money added and market growth for one pot, during ONE specific
 * calendar year (not cumulative) — null when no update was recorded that
 * year (nothing to report, not a confident zero — no forced cadence means a
 * skipped year is normal, spec §3), or when a recorded update that year is
 * missing money_in/transfer_out (spec §4 step 7's guard against a
 * confidently wrong number).
 */
function actualPotYearMetrics(
  accounts: { id: string; potCategory: PotCategory }[],
  snapshots: ActualSnapshotLike[],
  pot: PotFilter,
  calendarYear: number,
): { additions: number | null; growth: number | null } {
  const potAccountIds = new Set(accountsInPot(accounts, pot).map((a) => a.id))
  const yearSnapshots = snapshots.filter((s) => potAccountIds.has(s.accountId) && s.year === calendarYear)
  if (yearSnapshots.length === 0) return { additions: null, growth: null }

  let additions = 0
  let growth = 0
  let additionsKnown = true
  let growthKnown = true
  for (const s of yearSnapshots) {
    if (s.moneyIn === null) additionsKnown = false
    else additions += s.moneyIn
    const g = periodGrowth(s)
    if (g.growth === null) growthKnown = false
    else growth += g.growth
  }
  return { additions: additionsKnown ? additions : null, growth: growthKnown ? growth : null }
}

export type ForecastYearRow = {
  calendarYear: number
  age: number
  /** the ORIGINAL baseline's value for this year/pot — only populated once
   *  it differs from the plan-of-record (i.e. after a replan), so the UI
   *  only renders the faded secondary line when it's actually relevant */
  originalValue: number | null
  forecastValue: number
  actualValue: number | null
  forecastGrowth: number
  actualGrowth: number | null
  forecastAdditions: number
  actualAdditions: number | null
}

/**
 * Builds the year-by-year table rows for one pot (or the whole household):
 * value, growth and additions, forecast alongside actual — the current
 * plan-of-record always, the original baseline's value alongside it once a
 * replan has happened (spec §4 — "the fork must stay visible, never
 * disappear"), and real tracked figures for whichever calendar years have
 * already occurred.
 */
export function buildForecastYearRows(params: {
  planYearly: YearPoint[]
  planCreatedAt: string
  originalYearly: YearPoint[] | null
  originalCreatedAt: string | null
  hasReplanned: boolean
  accounts: { id: string; potCategory: PotCategory }[]
  snapshots: ActualSnapshotLike[]
  currentCalendarYear: number
  pot: PotFilter
}): ForecastYearRow[] {
  const planByYear = yearlyByCalendarYear(params.planYearly, params.planCreatedAt)
  const originalByYear =
    params.hasReplanned && params.originalYearly && params.originalCreatedAt
      ? yearlyByCalendarYear(params.originalYearly, params.originalCreatedAt)
      : new Map<number, YearPoint>()
  const potAccounts = accountsInPot(params.accounts, params.pot)

  return [...planByYear.keys()]
    .sort((a, b) => a - b)
    .map((calendarYear) => {
      const planFull = planByYear.get(calendarYear)!
      const plan = potPoint(planFull, params.pot)
      const originalFull = originalByYear.get(calendarYear)
      const original = originalFull ? potPoint(originalFull, params.pot) : null
      const isPast = calendarYear <= params.currentCalendarYear
      const { additions: actualAdditions, growth: actualGrowth } = isPast
        ? actualPotYearMetrics(params.accounts, params.snapshots, params.pot, calendarYear)
        : { additions: null, growth: null }

      return {
        calendarYear,
        age: planFull.age,
        originalValue: original ? original.endValue : null,
        forecastValue: plan.endValue,
        actualValue: isPast ? actualTotalAsOf(potAccounts, params.snapshots, calendarYear) : null,
        forecastGrowth: plan.growth,
        actualGrowth,
        forecastAdditions: plan.contribution,
        actualAdditions,
      }
    })
}

/** Never "behind" — spec §4's deliberate anti-verdict phrasing. */
export function varianceLabel(actual: number, plan: number): string {
  return actual > plan ? 'ahead of plan' : 'tracking to a revised plan'
}
