import { describe, expect, it } from 'vitest'
import {
  actualTotalAsOf,
  aggregateHouseholdState,
  buildForecastYearRows,
  canForecast,
  frozenStateToForecastInput,
  varianceLabel,
  yearlyByCalendarYear,
  type FrozenForecastState,
} from './householdForecast'
import { projectYearly } from './forecast'

describe('canForecast', () => {
  it('is false with no people', () => {
    expect(canForecast([], [{ potCategory: 'cash', monthlyContribution: 0, currentBalance: 100 }])).toBe(false)
  })
  it('is false with no accounts', () => {
    expect(canForecast([{ age: 30 }], [])).toBe(false)
  })
  it('is true once both exist', () => {
    expect(
      canForecast([{ age: 30 }], [{ potCategory: 'cash', monthlyContribution: 0, currentBalance: 100 }]),
    ).toBe(true)
  })
})

describe('aggregateHouseholdState', () => {
  const household = { retirementAge: 58, realReturn: 0.07, cashReturn: 0.045 }

  it('sums balances and monthly contributions by pot category', () => {
    const state = aggregateHouseholdState(household, [{ age: 36 }], [
      { potCategory: 'pension', monthlyContribution: 500, currentBalance: 20_000 },
      { potCategory: 'pension', monthlyContribution: 300, currentBalance: 10_000 },
      { potCategory: 'investments', monthlyContribution: 200, currentBalance: 5_000 },
      { potCategory: 'cash', monthlyContribution: 0, currentBalance: 12_000 },
    ])
    expect(state.pension).toBe(30_000)
    expect(state.pensionMonthly).toBe(800)
    expect(state.stocks).toBe(5_000)
    expect(state.monthly).toBe(200)
    expect(state.cash).toBe(12_000)
  })

  it('treats a null current_balance as zero', () => {
    const state = aggregateHouseholdState(household, [{ age: 30 }], [
      { potCategory: 'pension', monthlyContribution: 0, currentBalance: null },
    ])
    expect(state.pension).toBe(0)
  })

  it('uses the YOUNGER person as the anchor age — the longer horizon', () => {
    const state = aggregateHouseholdState(household, [{ age: 40 }, { age: 34 }], [
      { potCategory: 'cash', monthlyContribution: 0, currentBalance: 1_000 },
    ])
    expect(state.age).toBe(34)
  })

  it('carries the household assumptions through unchanged', () => {
    const state = aggregateHouseholdState(household, [{ age: 30 }], [
      { potCategory: 'cash', monthlyContribution: 0, currentBalance: 1 },
    ])
    expect(state.targetAge).toBe(58)
    expect(state.investedRate).toBe(0.07)
    expect(state.cashRate).toBe(0.045)
  })
})

describe('frozenStateToForecastInput', () => {
  it('maps the frozen shape onto ForecastInput + Assumptions', () => {
    const state: FrozenForecastState = {
      age: 36,
      targetAge: 58,
      pension: 20_000,
      stocks: 10_000,
      cash: 5_000,
      monthly: 300,
      pensionMonthly: 500,
      investedRate: 0.07,
      cashRate: 0.045,
    }
    const { input, assumptions } = frozenStateToForecastInput(state)
    expect(input).toEqual({ age: 36, pension: 20_000, stocks: 10_000, cash: 5_000, monthly: 300, pensionMonthly: 500 })
    expect(assumptions).toEqual({ investedRate: 0.07, cashRate: 0.045, targetAge: 58 })
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
    { age: 36, pension: 20_000, stocks: 0, cash: 0, monthly: 0 },
    { investedRate: 0.07, cashRate: 0.045, targetAge: 39 },
  )

  it('without a replan, originalTotal is always null', () => {
    const rows = buildForecastYearRows({
      planYearly: plan,
      planCreatedAt: '2026-01-01T00:00:00.000Z',
      originalYearly: null,
      originalCreatedAt: null,
      hasReplanned: false,
      accounts: [],
      snapshots: [],
      currentCalendarYear: 2026,
    })
    expect(rows.every((r) => r.originalTotal === null)).toBe(true)
  })

  it('with a replan, the original baseline is populated alongside the plan for overlapping years', () => {
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
    })
    const year2026 = rows.find((r) => r.calendarYear === 2026)!
    expect(year2026.planTotal).toBe(20_000)
    expect(year2026.originalTotal).toBe(15_000) // the smaller, un-replanned pot — stays visible, not overwritten
  })

  it('actualTotal is null for a calendar year that has not happened yet', () => {
    const rows = buildForecastYearRows({
      planYearly: plan,
      planCreatedAt: '2026-01-01T00:00:00.000Z',
      originalYearly: null,
      originalCreatedAt: null,
      hasReplanned: false,
      accounts: [{ id: 'a' }],
      snapshots: [{ accountId: 'a', year: 2026, recordedAt: '2026-01-01T00:00:00.000Z', endBalance: 20_000 }],
      currentCalendarYear: 2026,
    })
    const thisYear = rows.find((r) => r.calendarYear === 2026)!
    const futureYear = rows.find((r) => r.calendarYear === 2028)!
    expect(thisYear.actualTotal).toBe(20_000)
    expect(futureYear.actualTotal).toBeNull()
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
