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
import {
  clampMoney,
  futureValueContributions,
  futureValueLump,
  monthlyRate,
  monthsToTarget,
  resolvePensionMonthly,
  SCENARIO_META,
  type Assumptions,
  type ForecastInput,
  type PotYearPoint,
  type ScenarioKey,
  type YearPoint,
} from './forecast.js'
import { latestSnapshotByAccount, periodGrowth } from './snapshotMath.js'
import type { AccountOwner } from './accountOwner.js'

export type PotCategory = 'pension' | 'investments' | 'cash'

/** The table's pot filter — 'total' is the whole household, combined;
 *  'savingsAndInvestments' is cash + investments together, excluding
 *  pension (the restructure brief's five-slice taxonomy: Total / Savings /
 *  Investments / Pension / Savings + Investments, applied identically
 *  everywhere a pot filter appears). */
export type PotFilter = PotCategory | 'total' | 'savingsAndInvestments'

/** The page's owner filter — 'total' is the whole household, combined. */
export type OwnerFilter = 'total' | AccountOwner

export type PotTotals = {
  /** the age this slice's own projection is anchored to — see aggregateHouseholdState */
  age: number
  /** this slice's own horizon — each person's own retirement age; total/joint
   *  run to the later of the two people's own ages, expressed in the anchor
   *  person's age-frame (see aggregateHouseholdState) */
  targetAge: number
  pension: number
  stocks: number
  cash: number
  monthly: number
  pensionMonthly: number
  cashMonthly: number
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
  investedRate: number
  cashRate: number
  total: PotTotals
  personA: PotTotals | null
  personB: PotTotals | null
  /** joint accounts have no person of their own — anchored to the same age as `total` */
  joint: PotTotals
}

function isValidPotTotals(value: unknown): value is PotTotals {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.age === 'number' &&
    typeof v.targetAge === 'number' &&
    typeof v.pension === 'number' &&
    typeof v.stocks === 'number' &&
    typeof v.cash === 'number' &&
    typeof v.monthly === 'number' &&
    typeof v.pensionMonthly === 'number' &&
    typeof v.cashMonthly === 'number'
  )
}

/**
 * Runtime shape check for a parsed forecast_snapshots.household_state_json.
 * Guards against a baseline stored under an earlier version of this shape
 * (e.g. a flat {age,pension,stocks,...} row from before the owner-filter
 * split, or targetAge living at the top level from before per-person
 * retirement ages) being silently misread — callers should treat an invalid
 * state as equivalent to "no baseline yet," never destructure it directly.
 */
export function isValidFrozenState(value: unknown): value is FrozenForecastState {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v.investedRate !== 'number' || typeof v.cashRate !== 'number') return false
  if (!isValidPotTotals(v.total)) return false
  if (v.personA !== null && !isValidPotTotals(v.personA)) return false
  if (v.personB !== null && !isValidPotTotals(v.personB)) return false
  if (!isValidPotTotals(v.joint)) return false
  return true
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
      cashMonthly: totals.cashMonthly,
    },
    assumptions: {
      investedRate: state.investedRate,
      cashRate: state.cashRate,
      targetAge: totals.targetAge,
    },
  }
}

export type AggregatableHousehold = { realReturn: number; cashReturn: number }
export type AggregatablePerson = { age: number; retirementAge: number }
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

function potTotalsFor(accounts: AggregatableAccount[], age: number, targetAge: number): PotTotals {
  const sumBalance = (pot: PotCategory) =>
    accounts.filter((a) => a.potCategory === pot).reduce((s, a) => s + (a.currentBalance ?? 0), 0)
  const sumMonthly = (pot: PotCategory) =>
    accounts.filter((a) => a.potCategory === pot).reduce((s, a) => s + a.monthlyContribution, 0)
  return {
    age,
    targetAge,
    pension: sumBalance('pension'),
    stocks: sumBalance('investments'),
    cash: sumBalance('cash'),
    monthly: sumMonthly('investments'),
    pensionMonthly: sumMonthly('pension'),
    cashMonthly: sumMonthly('cash'),
  }
}

/**
 * The household-wide horizon when two people have different retirement
 * ages: runs until the LATER of the two reaches their own target, expressed
 * as an age in the anchor person's frame (anchorAge + that person's own
 * longest remaining years-to-retirement) — matching the whole-picture
 * principle rather than truncating the projection at whoever gets there
 * first. Degenerates to that one person's own retirement age when there's
 * only one person. Exported so scheduledPlan.ts's live projection resolves
 * 'total'/'joint' the exact same way as this frozen one does.
 */
export function householdTargetAge(anchorAge: number, people: { age: number; retirementAge: number }[]): number {
  const longestYearsToGo = Math.max(...people.map((p) => p.retirementAge - p.age))
  return anchorAge + longestYearsToGo
}

/**
 * Aggregates live household state into the forecast engine's input shape —
 * one slice per owner filter, so a person's own forecast can be projected
 * from their own age and their own retirement age, not a shared household
 * anchor. The household-wide ('total') anchor age is the YOUNGER person's;
 * `people[0]` is person_a, `people[1]` is person_b, matching
 * accountOwner.ts's convention.
 */
export function aggregateHouseholdState(
  household: AggregatableHousehold,
  people: AggregatablePerson[],
  accounts: AggregatableAccount[],
): FrozenForecastState {
  const anchorAge = Math.min(...people.map((p) => p.age))
  const totalTargetAge = householdTargetAge(anchorAge, people)

  return {
    investedRate: household.realReturn,
    cashRate: household.cashReturn,
    total: potTotalsFor(accounts, anchorAge, totalTargetAge),
    personA: people[0]
      ? potTotalsFor(accounts.filter((a) => a.owner === 'person_a'), people[0].age, people[0].retirementAge)
      : null,
    personB: people[1]
      ? potTotalsFor(accounts.filter((a) => a.owner === 'person_b'), people[1].age, people[1].retirementAge)
      : null,
    joint: potTotalsFor(accounts.filter((a) => a.owner === 'joint'), anchorAge, totalTargetAge),
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

function sumPotPoints(a: PotYearPoint, b: PotYearPoint): PotYearPoint {
  return {
    startValue: a.startValue + b.startValue,
    contribution: a.contribution + b.contribution,
    growth: a.growth + b.growth,
    endValue: a.endValue + b.endValue,
  }
}

/** Picks the pot's own start/contribution/growth/end out of a YearPoint. */
export function potPoint(point: YearPoint, pot: PotFilter): PotYearPoint {
  if (pot === 'pension') return point.pension
  if (pot === 'investments') return point.stocks
  if (pot === 'cash') return point.cash
  if (pot === 'savingsAndInvestments') return sumPotPoints(point.stocks, point.cash)
  return point.total
}

/** Filters accounts down to one pot-filter slice — the shared taxonomy's
 *  filtering rule, reused by every screen with a pot filter (Growth's
 *  balance/history filtering included) so 'total'/'savingsAndInvestments'
 *  never drift into a screen-specific reimplementation. */
export function accountsInPot<A extends { potCategory: PotCategory }>(accounts: A[], pot: PotFilter): A[] {
  if (pot === 'total') return accounts
  if (pot === 'savingsAndInvestments')
    return accounts.filter((a) => a.potCategory === 'investments' || a.potCategory === 'cash')
  return accounts.filter((a) => a.potCategory === pot)
}

export type PotScenario = {
  key: ScenarioKey
  label: string
  /** the monthly figure actually being varied by this scenario, for
   *  whichever pot is selected */
  monthly: number
  /** just the selected pot's own value at target age under this scenario */
  potTotal: number
  /** the whole household's value at target age under this scenario — the
   *  other two pots held at today's contribution, unchanged */
  total: number
  current: boolean
}

/**
 * "What changes if you change" scenarios, generalised across pot — unlike
 * forecast()'s own `scenarios` (always investments, matching the free
 * tool's simpler single-lever model), this varies whichever pot is
 * selected: pension, investments, or cash. 'total' still varies
 * investments (the household's usual flex lever, matching forecast()'s
 * default so a page that's never touched the pot filter sees no change)
 * but reports the household total rather than just that one pot.
 * Deliberately excludes 'savingsAndInvestments' — this tool varies exactly
 * one lever at a time, and "vary both pots at once" has no single
 * unambiguous meaning, so callers can't even pass it (see PotFilter).
 */
export function buildPotScenarios(
  input: ForecastInput,
  a: Assumptions,
  pot: Exclude<PotFilter, 'savingsAndInvestments'>,
): PotScenario[] {
  const months = monthsToTarget(input.age, a.targetAge)
  const mInv = monthlyRate(a.investedRate)
  const mCash = monthlyRate(a.cashRate)

  const pension = clampMoney(input.pension)
  const stocks = clampMoney(input.stocks)
  const cash = clampMoney(input.cash)

  const basePensionMonthly = resolvePensionMonthly(input).monthly
  const baseStocksMonthly = clampMoney(input.monthly)
  const baseCashMonthly = clampMoney(input.cashMonthly ?? 0)

  const variesPot: PotCategory = pot === 'pension' ? 'pension' : pot === 'cash' ? 'cash' : 'investments'
  const baseMonthly =
    variesPot === 'pension' ? basePensionMonthly : variesPot === 'cash' ? baseCashMonthly : baseStocksMonthly

  return SCENARIO_META.map((s) => {
    const scenarioMonthly = s.delta === 'stop' ? 0 : baseMonthly + s.delta

    const pensionMonthly = variesPot === 'pension' ? scenarioMonthly : basePensionMonthly
    const stocksMonthly = variesPot === 'investments' ? scenarioMonthly : baseStocksMonthly
    const cashMonthly = variesPot === 'cash' ? scenarioMonthly : baseCashMonthly

    const pensionFuture =
      futureValueLump(pension, mInv, months) + futureValueContributions(pensionMonthly, mInv, months)
    const stocksFuture =
      futureValueLump(stocks, mInv, months) + futureValueContributions(stocksMonthly, mInv, months)
    const cashFuture = futureValueLump(cash, mCash, months) + futureValueContributions(cashMonthly, mCash, months)

    const potTotal = variesPot === 'pension' ? pensionFuture : variesPot === 'cash' ? cashFuture : stocksFuture

    return {
      key: s.key,
      label: s.label,
      monthly: scenarioMonthly,
      potTotal,
      total: pensionFuture + stocksFuture + cashFuture,
      current: s.key === 'carryOn',
    }
  })
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
 * skipped year is normal, spec §3), or when NONE of that year's updates have
 * usable money_in/transfer_out figures.
 *
 * A year with several updates, some complete and some not, still reports the
 * sum of the complete ones — spec §4 step 7 guards against a confidently
 * wrong number for one incomplete *snapshot*, not against ever reporting a
 * partial total for a year that has other, complete snapshots. This mirrors
 * totalGrowth()'s tolerance on the Growth tab (sum what's known, skip what
 * isn't) — the two tabs must agree on the same underlying data.
 */
export function actualPotYearMetrics(
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
  let hasKnownAdditions = false
  let hasKnownGrowth = false
  for (const s of yearSnapshots) {
    if (s.moneyIn !== null) {
      additions += s.moneyIn
      hasKnownAdditions = true
    }
    const g = periodGrowth(s)
    if (g.growth !== null) {
      growth += g.growth
      hasKnownGrowth = true
    }
  }
  return { additions: hasKnownAdditions ? additions : null, growth: hasKnownGrowth ? growth : null }
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
