import { describe, expect, it } from 'vitest'
import {
  actualTotalAsOf,
  aggregateHouseholdState,
  buildForecastYearRows,
  canForecast,
  isValidFrozenState,
  ownerStateToForecastInput,
  varianceLabel,
  yearlyByCalendarYear,
  type AggregatableAccount,
  type FrozenForecastState,
} from './householdForecast'
import { projectYearly } from './forecast'

const acc = (over: Partial<AggregatableAccount>): AggregatableAccount => ({
  owner: 'person_a',
  potCategory: 'cash',
  monthlyContribution: 0,
  currentBalance: 0,
  ...over,
})

describe('canForecast', () => {
  it('is false with no people', () => {
    expect(canForecast([], [acc({ currentBalance: 100 })])).toBe(false)
  })
  it('is false with no accounts', () => {
    expect(canForecast([{ age: 30 }], [])).toBe(false)
  })
  it('is true once both exist', () => {
    expect(canForecast([{ age: 30 }], [acc({ currentBalance: 100 })])).toBe(true)
  })
})

describe('aggregateHouseholdState', () => {
  const household = { retirementAge: 60, realReturn: 0.07, cashReturn: 0.045 }

  it("sums the household TOTAL across every owner's balances and monthly contributions", () => {
    const state = aggregateHouseholdState(household, [{ age: 36 }], [
      acc({ owner: 'person_a', potCategory: 'pension', monthlyContribution: 500, currentBalance: 20_000 }),
      acc({ owner: 'person_a', potCategory: 'investments', monthlyContribution: 200, currentBalance: 5_000 }),
      acc({ owner: 'joint', potCategory: 'cash', monthlyContribution: 0, currentBalance: 12_000 }),
    ])
    expect(state.total.pension).toBe(20_000)
    expect(state.total.pensionMonthly).toBe(500)
    expect(state.total.stocks).toBe(5_000)
    expect(state.total.monthly).toBe(200)
    expect(state.total.cash).toBe(12_000)
  })

  it('treats a null current_balance as zero', () => {
    const state = aggregateHouseholdState(household, [{ age: 30 }], [
      acc({ potCategory: 'pension', currentBalance: null }),
    ])
    expect(state.total.pension).toBe(0)
  })

  it("total's anchor age is the YOUNGER person's — the longer horizon", () => {
    const state = aggregateHouseholdState(household, [{ age: 40 }, { age: 34 }], [acc({ currentBalance: 1_000 })])
    expect(state.total.age).toBe(34)
  })

  it("splits balances by owner into personA/personB/joint, each with that person's OWN age", () => {
    const state = aggregateHouseholdState(household, [{ age: 40 }, { age: 34 }], [
      acc({ owner: 'person_a', potCategory: 'pension', currentBalance: 100_000 }),
      acc({ owner: 'person_b', potCategory: 'pension', currentBalance: 40_000 }),
      acc({ owner: 'joint', potCategory: 'cash', currentBalance: 5_000 }),
    ])
    expect(state.personA).toEqual({ age: 40, pension: 100_000, stocks: 0, cash: 0, monthly: 0, pensionMonthly: 0 })
    expect(state.personB).toEqual({ age: 34, pension: 40_000, stocks: 0, cash: 0, monthly: 0, pensionMonthly: 0 })
    expect(state.joint.cash).toBe(5_000)
    expect(state.joint.age).toBe(state.total.age) // joint has no person of its own — anchored to the household age
  })

  it('personB is null when only one person exists', () => {
    const state = aggregateHouseholdState(household, [{ age: 36 }], [acc({ currentBalance: 1 })])
    expect(state.personB).toBeNull()
  })

  it('carries the household assumptions through unchanged', () => {
    const state = aggregateHouseholdState(household, [{ age: 30 }], [acc({ currentBalance: 1 })])
    expect(state.targetAge).toBe(60)
    expect(state.investedRate).toBe(0.07)
    expect(state.cashRate).toBe(0.045)
  })
})

describe('ownerStateToForecastInput', () => {
  const state: FrozenForecastState = {
    targetAge: 60,
    investedRate: 0.07,
    cashRate: 0.045,
    total: { age: 34, pension: 140_000, stocks: 30_000, cash: 12_000, monthly: 300, pensionMonthly: 500 },
    personA: { age: 36, pension: 100_000, stocks: 20_000, cash: 0, monthly: 200, pensionMonthly: 500 },
    personB: null,
    joint: { age: 34, pension: 0, stocks: 0, cash: 12_000, monthly: 0, pensionMonthly: 0 },
  }

  it("maps the 'total' slice onto ForecastInput + Assumptions", () => {
    const result = ownerStateToForecastInput(state, 'total')!
    expect(result.input).toEqual({ age: 34, pension: 140_000, stocks: 30_000, cash: 12_000, monthly: 300, pensionMonthly: 500 })
    expect(result.assumptions).toEqual({ investedRate: 0.07, cashRate: 0.045, targetAge: 60 })
  })

  it("maps person_a's own slice, using THEIR OWN age not the household anchor", () => {
    const result = ownerStateToForecastInput(state, 'person_a')!
    expect(result.input.age).toBe(36)
    expect(result.input.pension).toBe(100_000)
  })

  it('returns null for a person who does not exist', () => {
    expect(ownerStateToForecastInput(state, 'person_b')).toBeNull()
  })

  it('maps the joint slice', () => {
    const result = ownerStateToForecastInput(state, 'joint')!
    expect(result.input.cash).toBe(12_000)
  })
})

describe('isValidFrozenState', () => {
  const state: FrozenForecastState = {
    targetAge: 60,
    investedRate: 0.07,
    cashRate: 0.045,
    total: { age: 34, pension: 140_000, stocks: 30_000, cash: 12_000, monthly: 300, pensionMonthly: 500 },
    personA: { age: 36, pension: 100_000, stocks: 20_000, cash: 0, monthly: 200, pensionMonthly: 500 },
    personB: null,
    joint: { age: 34, pension: 0, stocks: 0, cash: 12_000, monthly: 0, pensionMonthly: 0 },
  }

  it('accepts a well-formed current-shape state', () => {
    expect(isValidFrozenState(state)).toBe(true)
  })

  it('accepts personA/personB being null', () => {
    expect(isValidFrozenState({ ...state, personA: null, personB: null })).toBe(true)
  })

  it('rejects a pre-owner-filter flat baseline — the exact shape stored before this change shipped', () => {
    const legacyFlatState = {
      age: 36,
      targetAge: 58,
      pension: 140_000,
      stocks: 30_000,
      cash: 12_000,
      monthly: 300,
      pensionMonthly: 500,
      investedRate: 0.07,
      cashRate: 0.045,
    }
    expect(isValidFrozenState(legacyFlatState)).toBe(false)
  })

  it('rejects null, undefined, and non-objects', () => {
    expect(isValidFrozenState(null)).toBe(false)
    expect(isValidFrozenState(undefined)).toBe(false)
    expect(isValidFrozenState('not an object')).toBe(false)
    expect(isValidFrozenState(42)).toBe(false)
  })

  it('rejects a state missing the total slice', () => {
    const { total: _total, ...rest } = state
    expect(isValidFrozenState(rest)).toBe(false)
  })

  it('rejects a personA that is present but malformed', () => {
    expect(isValidFrozenState({ ...state, personA: { age: 36 } })).toBe(false)
  })
})

describe('yearlyByCalendarYear', () => {
  it('re-indexes years-from-creation onto real calendar years', () => {
    const yearly = projectYearly(
      { age: 36, pension: 10_000, stocks: 0, cash: 0, monthly: 0 },
      { investedRate: 0.07, cashRate: 0.045, targetAge: 39 },
    )
    const byYear = yearlyByCalendarYear(yearly, '2026-03-15T00:00:00.000Z')
    expect(byYear.get(2026)!.year).toBe(0)
    expect(byYear.get(2027)!.year).toBe(1)
    expect(byYear.get(2029)!.year).toBe(3)
  })
})

describe('actualTotalAsOf', () => {
  const accounts = [{ id: 'a' }, { id: 'b' }]

  it('sums each account\'s latest snapshot at or before the given year', () => {
    const snapshots = [
      { accountId: 'a', year: 2025, recordedAt: '2025-01-01T00:00:00.000Z', endBalance: 10_000 },
      { accountId: 'a', year: 2026, recordedAt: '2026-01-01T00:00:00.000Z', endBalance: 11_000 },
      { accountId: 'b', year: 2025, recordedAt: '2025-06-01T00:00:00.000Z', endBalance: 5_000 },
    ]
    expect(actualTotalAsOf(accounts, snapshots, 2025)).toBe(15_000) // 10k + 5k, not the 2026 update
    expect(actualTotalAsOf(accounts, snapshots, 2026)).toBe(16_000) // 11k + 5k
  })

  it("excludes an account that didn't exist yet — no eligible snapshot, contributes 0", () => {
    const snapshots = [{ accountId: 'a', year: 2027, recordedAt: '2027-01-01T00:00:00.000Z', endBalance: 1_000 }]
    expect(actualTotalAsOf(accounts, snapshots, 2025)).toBe(0)
  })

  it('breaks a same-year tie by recordedAt, not just year', () => {
    const snapshots = [
      { accountId: 'a', year: 2026, recordedAt: '2026-01-01T00:00:00.000Z', endBalance: 1_000 },
      { accountId: 'a', year: 2026, recordedAt: '2026-06-01T00:00:00.000Z', endBalance: 1_500 },
    ]
    expect(actualTotalAsOf([{ id: 'a' }], snapshots, 2026)).toBe(1_500)
  })
})

describe('buildForecastYearRows', () => {
  const plan = projectYearly(
    { age: 36, pension: 20_000, stocks: 8_000, cash: 0, monthly: 0 },
    { investedRate: 0.07, cashRate: 0.045, targetAge: 39 },
  )

  it('without a replan, originalValue is always null', () => {
    const rows = buildForecastYearRows({
      planYearly: plan,
      planCreatedAt: '2026-01-01T00:00:00.000Z',
      originalYearly: null,
      originalCreatedAt: null,
      hasReplanned: false,
      accounts: [],
      snapshots: [],
      currentCalendarYear: 2026,
      pot: 'total',
    })
    expect(rows.every((r) => r.originalValue === null)).toBe(true)
  })

  it('with a replan, the original baseline value is populated alongside the plan for overlapping years', () => {
    const original = projectYearly(
      { age: 36, pension: 15_000, stocks: 0, cash: 0, monthly: 0 },
      { investedRate: 0.07, cashRate: 0.045, targetAge: 39 },
    )
    const rows = buildForecastYearRows({
      planYearly: plan,
      planCreatedAt: '2026-01-01T00:00:00.000Z',
      originalYearly: original,
      originalCreatedAt: '2026-01-01T00:00:00.000Z',
      hasReplanned: true,
      accounts: [],
      snapshots: [],
      currentCalendarYear: 2026,
      pot: 'total',
    })
    const year2026 = rows.find((r) => r.calendarYear === 2026)!
    expect(year2026.forecastValue).toBe(28_000)
    expect(year2026.originalValue).toBe(15_000) // the smaller, un-replanned pot — stays visible, not overwritten
  })

  it("the 'pot' filter scopes the forecast figures to just that pot", () => {
    const rows = buildForecastYearRows({
      planYearly: plan,
      planCreatedAt: '2026-01-01T00:00:00.000Z',
      originalYearly: null,
      originalCreatedAt: null,
      hasReplanned: false,
      accounts: [],
      snapshots: [],
      currentCalendarYear: 2026,
      pot: 'pension',
    })
    expect(rows.find((r) => r.calendarYear === 2026)!.forecastValue).toBe(20_000) // pension only, not the 8k stocks too
  })

  it('actualValue is null for a calendar year that has not happened yet', () => {
    const rows = buildForecastYearRows({
      planYearly: plan,
      planCreatedAt: '2026-01-01T00:00:00.000Z',
      originalYearly: null,
      originalCreatedAt: null,
      hasReplanned: false,
      accounts: [{ id: 'a', potCategory: 'pension' }],
      snapshots: [
        {
          accountId: 'a',
          year: 2026,
          recordedAt: '2026-01-01T00:00:00.000Z',
          startBalance: 20_000,
          endBalance: 20_000,
          moneyIn: 0,
          transferOut: 0,
        },
      ],
      currentCalendarYear: 2026,
      pot: 'total',
    })
    const thisYear = rows.find((r) => r.calendarYear === 2026)!
    const futureYear = rows.find((r) => r.calendarYear === 2028)!
    expect(thisYear.actualValue).toBe(20_000)
    expect(futureYear.actualValue).toBeNull()
  })

  it('actualGrowth/actualAdditions sum only the snapshots recorded in that specific year, for that pot', () => {
    const rows = buildForecastYearRows({
      planYearly: plan,
      planCreatedAt: '2026-01-01T00:00:00.000Z',
      originalYearly: null,
      originalCreatedAt: null,
      hasReplanned: false,
      accounts: [
        { id: 'pension-acc', potCategory: 'pension' },
        { id: 'cash-acc', potCategory: 'cash' },
      ],
      snapshots: [
        {
          accountId: 'pension-acc',
          year: 2026,
          recordedAt: '2026-06-01T00:00:00.000Z',
          startBalance: 20_000,
          endBalance: 20_900,
          moneyIn: 500,
          transferOut: 0,
        },
        // a cash update the same year must NOT leak into the 'pension' filter
        {
          accountId: 'cash-acc',
          year: 2026,
          recordedAt: '2026-06-01T00:00:00.000Z',
          startBalance: 1_000,
          endBalance: 5_000,
          moneyIn: 4_000,
          transferOut: 0,
        },
      ],
      currentCalendarYear: 2026,
      pot: 'pension',
    })
    const row = rows.find((r) => r.calendarYear === 2026)!
    expect(row.actualAdditions).toBe(500)
    expect(row.actualGrowth).toBe(400) // 20900-20000-500+0
  })

  it('a year with no recorded update shows actualGrowth/actualAdditions as null, not zero', () => {
    const rows = buildForecastYearRows({
      planYearly: plan,
      planCreatedAt: '2026-01-01T00:00:00.000Z',
      originalYearly: null,
      originalCreatedAt: null,
      hasReplanned: false,
      accounts: [{ id: 'a', potCategory: 'pension' }],
      snapshots: [], // never updated
      currentCalendarYear: 2027,
      pot: 'total',
    })
    const row = rows.find((r) => r.calendarYear === 2026)!
    expect(row.actualAdditions).toBeNull()
    expect(row.actualGrowth).toBeNull()
  })
})

describe('varianceLabel (never "behind" — spec §4)', () => {
  it('says "ahead of plan" when actual beats the plan', () => {
    expect(varianceLabel(110_000, 100_000)).toBe('ahead of plan')
  })
  it('never says "behind" — uses the neutral revised-plan phrasing instead', () => {
    const label = varianceLabel(90_000, 100_000)
    expect(label).toBe('tracking to a revised plan')
    expect(label.toLowerCase()).not.toContain('behind')
  })
})
