import { describe, expect, it } from 'vitest'
import {
  buildScheduledForecastYearRows,
  buildScheduledPlan,
  buildScheduledPlanInput,
  findScheduledCrossoverYear,
  projectScheduledYearly,
  resolveAnnualBonusSchedule,
  resolveContributionBreakdown,
  resolveMonthlySchedule,
  type ContributionChange,
  type OwnerScopedContributionChange,
  type OwnerScopedPlannedEvent,
  type PlannedEvent,
  type ScheduledPlanAccount,
  type ScheduledPlanInput,
} from './scheduledPlan'

describe('resolveMonthlySchedule', () => {
  it('stays at the base value with no changes', () => {
    const schedule = resolveMonthlySchedule(1_500, [], 2026, 2029)
    expect([...schedule.values()]).toEqual([1_500, 1_500, 1_500, 1_500])
  })

  it('a "set" change takes effect from its year onward, flat', () => {
    const changes: ContributionChange[] = [
      { potCategory: 'investments', effectiveYear: 2028, changeType: 'set', value: 2_000 },
    ]
    const schedule = resolveMonthlySchedule(1_500, changes, 2026, 2030)
    expect(schedule.get(2026)).toBe(1_500)
    expect(schedule.get(2027)).toBe(1_500)
    expect(schedule.get(2028)).toBe(2_000)
    expect(schedule.get(2029)).toBe(2_000)
    expect(schedule.get(2030)).toBe(2_000)
  })

  it('a "grow_pct" change compounds every year, not just once — applied immediately in its own effective year', () => {
    const changes: ContributionChange[] = [
      { potCategory: 'investments', effectiveYear: 2026, changeType: 'grow_pct', value: 0.01 },
    ]
    const schedule = resolveMonthlySchedule(1_000, changes, 2026, 2028)
    expect(schedule.get(2026)).toBeCloseTo(1_010, 5)
    expect(schedule.get(2027)).toBeCloseTo(1_020.1, 5)
    expect(schedule.get(2028)).toBeCloseTo(1_030.301, 5)
  })

  it('a later change supersedes an earlier "grow_pct", stopping its compounding', () => {
    const changes: ContributionChange[] = [
      { potCategory: 'investments', effectiveYear: 2026, changeType: 'grow_pct', value: 0.1 },
      { potCategory: 'investments', effectiveYear: 2028, changeType: 'set', value: 500 },
    ]
    const schedule = resolveMonthlySchedule(1_000, changes, 2026, 2030)
    expect(schedule.get(2027)).toBeCloseTo(1_210, 5) // two years of 10% growth: 1000*1.1*1.1
    expect(schedule.get(2028)).toBe(500) // flat override, not the ~1_464 the old growth path would give
    expect(schedule.get(2030)).toBe(500)
  })

  it('never returns a negative monthly figure', () => {
    const changes: ContributionChange[] = [
      { potCategory: 'cash', effectiveYear: 2026, changeType: 'set', value: -200 },
    ]
    const schedule = resolveMonthlySchedule(100, changes, 2026, 2026)
    expect(schedule.get(2026)).toBe(0)
  })

  it('ignores annual_bonus changes entirely — they never leak into the monthly figure', () => {
    const changes: ContributionChange[] = [
      { potCategory: 'investments', effectiveYear: 2026, changeType: 'annual_bonus', value: 5_000 },
    ]
    const schedule = resolveMonthlySchedule(500, changes, 2026, 2026)
    expect(schedule.get(2026)).toBe(500) // unaffected by the £5,000 bonus change
  })
})

describe('resolveAnnualBonusSchedule', () => {
  it('is 0 before any annual_bonus change exists', () => {
    const schedule = resolveAnnualBonusSchedule([], 2026, 2028)
    expect([...schedule.values()]).toEqual([0, 0, 0])
  })

  it('applies from its effective year onward, flat — never compounding like grow_pct', () => {
    const changes: ContributionChange[] = [
      { potCategory: 'investments', effectiveYear: 2027, changeType: 'annual_bonus', value: 2_000 },
    ]
    const schedule = resolveAnnualBonusSchedule(changes, 2026, 2029)
    expect(schedule.get(2026)).toBe(0)
    expect(schedule.get(2027)).toBe(2_000)
    expect(schedule.get(2028)).toBe(2_000) // same £2,000 every year, not growing
    expect(schedule.get(2029)).toBe(2_000)
  })

  it('a later bonus change supersedes an earlier one', () => {
    const changes: ContributionChange[] = [
      { potCategory: 'investments', effectiveYear: 2026, changeType: 'annual_bonus', value: 2_000 },
      { potCategory: 'investments', effectiveYear: 2028, changeType: 'annual_bonus', value: 3_500 },
    ]
    const schedule = resolveAnnualBonusSchedule(changes, 2026, 2029)
    expect(schedule.get(2027)).toBe(2_000)
    expect(schedule.get(2028)).toBe(3_500)
  })

  it('ignores set/grow_pct changes entirely — only annual_bonus feeds this schedule', () => {
    const changes: ContributionChange[] = [
      { potCategory: 'investments', effectiveYear: 2026, changeType: 'set', value: 900 },
      { potCategory: 'investments', effectiveYear: 2026, changeType: 'grow_pct', value: 0.05 },
    ]
    const schedule = resolveAnnualBonusSchedule(changes, 2026, 2026)
    expect(schedule.get(2026)).toBe(0)
  })

  it('never returns a negative bonus', () => {
    const changes: ContributionChange[] = [
      { potCategory: 'investments', effectiveYear: 2026, changeType: 'annual_bonus', value: -500 },
    ]
    expect(resolveAnnualBonusSchedule(changes, 2026, 2026).get(2026)).toBe(0)
  })
})

describe('projectScheduledYearly', () => {
  const basePots: ScheduledPlanInput['pots'] = {
    pension: { balance: 0, rate: 0.07, baseMonthly: 0 },
    investments: { balance: 10_000, rate: 0.07, baseMonthly: 500 },
    cash: { balance: 5_000, rate: 0.045, baseMonthly: 0 },
  }

  it('year 0 is a snapshot of today, with no growth/contribution/events yet', () => {
    const points = projectScheduledYearly({
      startYear: 2026,
      age: 30,
      targetAge: 32,
      pots: basePots,
      changes: [],
      events: [],
    })
    const y0 = points[0]!
    expect(y0.calendarYear).toBe(2026)
    expect(y0.total.startValue).toBe(15_000)
    expect(y0.total.endValue).toBe(15_000)
    expect(y0.total.growth).toBe(0)
    expect(y0.total.contribution).toBe(0)
  })

  it('with no schedule changes, matches plain compounding for the whole horizon', () => {
    const points = projectScheduledYearly({
      startYear: 2026,
      age: 30,
      targetAge: 31,
      pots: basePots,
      changes: [],
      events: [],
    })
    const y1 = points.find((p) => p.calendarYear === 2027)!
    // one year of £500/mo at 7% nominal, monthly-compounded
    expect(y1.investments.contribution).toBe(6_000)
    expect(y1.investments.endValue).toBeGreaterThan(10_000 + 6_000) // grew, didn't just add up
    expect(y1.investments.growth).toBeGreaterThan(0)
  })

  it('a contribution change from a future year raises that year onward, not before', () => {
    const changes: ContributionChange[] = [
      { potCategory: 'investments', effectiveYear: 2028, changeType: 'set', value: 600 },
    ]
    const points = projectScheduledYearly({
      startYear: 2026,
      age: 30,
      targetAge: 33,
      pots: basePots,
      changes,
      events: [],
    })
    expect(points.find((p) => p.calendarYear === 2027)!.investments.contribution).toBe(6_000) // still £500/mo
    expect(points.find((p) => p.calendarYear === 2028)!.investments.contribution).toBe(7_200) // now £600/mo
  })

  it('a planned event shows as its own line, never folded into growth', () => {
    const events: PlannedEvent[] = [{ potCategory: 'cash', year: 2027, amount: 10_000 }]
    const points = projectScheduledYearly({
      startYear: 2026,
      age: 30,
      targetAge: 31,
      pots: basePots,
      changes: [],
      events,
    })
    const y1 = points.find((p) => p.calendarYear === 2027)!
    expect(y1.cash.events).toBe(10_000)
    expect(y1.cash.endValue).toBeGreaterThan(5_000 + 10_000) // the deposit plus real market growth
    // growth is the market's share only — the £10k deposit isn't counted as "growth"
    const cashGrowthOnly = y1.cash.endValue - y1.cash.startValue - y1.cash.contribution - y1.cash.events
    expect(y1.cash.growth).toBeCloseTo(cashGrowthOnly, 5)
  })

  it('a planned event compounds from its own year, not just the years after', () => {
    // the bug this fixed: a deposit used to earn zero growth in its own year
    // because it was added to the balance after that year's growth was
    // already calculated on the pre-event amount
    const withoutEvent = projectScheduledYearly({
      startYear: 2026,
      age: 30,
      targetAge: 31,
      pots: basePots,
      changes: [],
      events: [],
    })
    const withEvent = projectScheduledYearly({
      startYear: 2026,
      age: 30,
      targetAge: 31,
      pots: basePots,
      changes: [],
      events: [{ potCategory: 'cash', year: 2027, amount: 10_000 }],
    })
    const y1NoEvent = withoutEvent.find((p) => p.calendarYear === 2027)!
    const y1WithEvent = withEvent.find((p) => p.calendarYear === 2027)!
    // the £10k itself grows for the full year, on top of the growth the
    // pre-existing balance was already going to earn
    expect(y1WithEvent.cash.growth).toBeGreaterThan(y1NoEvent.cash.growth + 10_000 * 0.04)
    // and endValue reflects a full year of compounding on the deposit too —
    // not just the deposit sitting there flat
    const growthAttributableToDeposit = y1WithEvent.cash.endValue - y1NoEvent.cash.endValue
    expect(growthAttributableToDeposit).toBeGreaterThan(10_000)
  })

  it('a negative planned event (a withdrawal) never drives a pot below zero', () => {
    const events: PlannedEvent[] = [{ potCategory: 'cash', year: 2027, amount: -50_000 }]
    const points = projectScheduledYearly({
      startYear: 2026,
      age: 30,
      targetAge: 31,
      pots: basePots,
      changes: [],
      events,
    })
    expect(points.find((p) => p.calendarYear === 2027)!.cash.endValue).toBe(0)
  })

  it('total is always the sum of the three pots', () => {
    const points = projectScheduledYearly({
      startYear: 2026,
      age: 30,
      targetAge: 34,
      pots: {
        pension: { balance: 20_000, rate: 0.07, baseMonthly: 500 },
        investments: { balance: 10_000, rate: 0.07, baseMonthly: 300 },
        cash: { balance: 5_000, rate: 0.045, baseMonthly: 100 },
      },
      changes: [{ potCategory: 'pension', effectiveYear: 2029, changeType: 'grow_pct', value: 0.02 }],
      events: [{ potCategory: 'investments', year: 2030, amount: 2_000 }],
    })
    for (const p of points) {
      expect(p.total.endValue).toBeCloseTo(p.pension.endValue + p.investments.endValue + p.cash.endValue, 5)
      expect(p.total.contribution).toBeCloseTo(
        p.pension.contribution + p.investments.contribution + p.cash.contribution,
        5,
      )
    }
  })

  it('an annual bonus is folded into contribution, arriving as a lump with no growth of its own that year', () => {
    const changes: ContributionChange[] = [
      { potCategory: 'investments', effectiveYear: 2027, changeType: 'annual_bonus', value: 3_000 },
    ]
    const points = projectScheduledYearly({
      startYear: 2026,
      age: 30,
      targetAge: 32,
      pots: basePots,
      changes,
      events: [],
    })
    const y1 = points.find((p) => p.calendarYear === 2027)!
    expect(y1.investments.contribution).toBe(6_000 + 3_000) // £500/mo × 12 + the £3,000 bonus
    const withoutBonusYear = projectScheduledYearly({
      startYear: 2026,
      age: 30,
      targetAge: 32,
      pots: basePots,
      changes: [],
      events: [],
    }).find((p) => p.calendarYear === 2027)!
    expect(y1.investments.growth).toBeCloseTo(withoutBonusYear.investments.growth, 5) // same market growth either way
    expect(y1.investments.endValue).toBeCloseTo(withoutBonusYear.investments.endValue + 3_000, 5)
  })
})

describe('buildScheduledPlan', () => {
  const household = { realReturn: 0.07, cashReturn: 0.045 }
  const people = [
    { age: 30, retirementAge: 60 },
    { age: 32, retirementAge: 60 },
  ]
  const accounts: ScheduledPlanAccount[] = [
    { owner: 'person_a', potCategory: 'investments', monthlyContribution: 500, currentBalance: 10_000 },
    { owner: 'person_b', potCategory: 'investments', monthlyContribution: 300, currentBalance: 4_000 },
    { owner: 'joint', potCategory: 'cash', monthlyContribution: 0, currentBalance: 2_000 },
  ]

  it('returns null for a person who does not exist yet', () => {
    const result = buildScheduledPlan({
      owner: 'person_b',
      startYear: 2026,
      people: [{ age: 30, retirementAge: 60 }], // only person_a exists
      household,
      accounts,
      changes: [],
      events: [],
    })
    expect(result).toBeNull()
  })

  it("'total' anchors to the younger person's age and includes every owner's accounts", () => {
    const result = buildScheduledPlan({
      owner: 'total',
      startYear: 2026,
      people,
      household,
      accounts,
      changes: [],
      events: [],
    })!
    expect(result[0]!.age).toBe(30) // the younger of 30/32
    expect(result[0]!.investments.startValue).toBe(14_000) // person_a + person_b
    expect(result[0]!.cash.startValue).toBe(2_000) // joint
  })

  it("a specific owner's projection runs to THEIR OWN retirement age, not a shared one", () => {
    const result = buildScheduledPlan({
      owner: 'person_a',
      startYear: 2026,
      people: [
        { age: 30, retirementAge: 32 }, // just 2 years to go
        { age: 32, retirementAge: 60 },
      ],
      household,
      accounts,
      changes: [],
      events: [],
    })!
    expect(result.at(-1)!.age).toBe(32) // stops at person_a's own retirement age, not person_b's
  })

  it("'total' runs to the LATER of the two people's own retirement ages", () => {
    const result = buildScheduledPlan({
      owner: 'total',
      startYear: 2026,
      people: [
        { age: 30, retirementAge: 32 }, // 2 years to go
        { age: 32, retirementAge: 40 }, // 8 years to go — the longer horizon
      ],
      household,
      accounts,
      changes: [],
      events: [],
    })!
    // anchored at the younger person's current age (30), run out 8 years (the
    // longer of the two) — not 2 years, and not to age 40 directly
    expect(result.at(-1)!.age).toBe(38)
  })

  it('a specific owner only sees their own accounts and age', () => {
    const result = buildScheduledPlan({
      owner: 'person_a',
      startYear: 2026,
      people,
      household,
      accounts,
      changes: [],
      events: [],
    })!
    expect(result[0]!.age).toBe(30)
    expect(result[0]!.investments.startValue).toBe(10_000) // not person_b's 4,000
  })

  it("a specific owner's changes/events are scoped — another owner's don't leak in", () => {
    const changes: OwnerScopedContributionChange[] = [
      { owner: 'person_a', potCategory: 'investments', effectiveYear: 2028, changeType: 'set', value: 900 },
      { owner: 'person_b', potCategory: 'investments', effectiveYear: 2028, changeType: 'set', value: 100 },
    ]
    const result = buildScheduledPlan({
      owner: 'person_a',
      startYear: 2026,
      people,
      household,
      accounts,
      changes,
      events: [],
    })!
    expect(result.find((p) => p.calendarYear === 2028)!.investments.contribution).toBe(900 * 12)
  })

  it("'total' pools every owner's changes/events together", () => {
    const events: OwnerScopedPlannedEvent[] = [
      { owner: 'joint', potCategory: 'cash', year: 2027, amount: 5_000 },
    ]
    const result = buildScheduledPlan({
      owner: 'total',
      startYear: 2026,
      people,
      household,
      accounts,
      changes: [],
      events,
    })!
    expect(result.find((p) => p.calendarYear === 2027)!.cash.events).toBe(5_000)
  })

  it('cash grows at the household cash rate, investments at the invested rate', () => {
    const result = buildScheduledPlan({
      owner: 'total',
      startYear: 2026,
      people,
      household: { realReturn: 0.5, cashReturn: 0 }, // exaggerated to make the split obvious
      accounts: [
        { owner: 'joint', potCategory: 'investments', monthlyContribution: 0, currentBalance: 10_000 },
        { owner: 'joint', potCategory: 'cash', monthlyContribution: 0, currentBalance: 10_000 },
      ],
      changes: [],
      events: [],
    })!
    const y1 = result.find((p) => p.calendarYear === 2027)!
    expect(y1.investments.growth).toBeGreaterThan(0)
    expect(y1.cash.growth).toBe(0) // 0% cash rate — no growth at all
  })
})

describe('resolveContributionBreakdown', () => {
  const accounts: ScheduledPlanAccount[] = [
    { owner: 'person_a', potCategory: 'pension', monthlyContribution: 516, currentBalance: 45_458 },
    { owner: 'person_a', potCategory: 'investments', monthlyContribution: 25, currentBalance: 1_189 },
    { owner: 'person_b', potCategory: 'investments', monthlyContribution: 1_950, currentBalance: 27_982 },
    { owner: 'joint', potCategory: 'cash', monthlyContribution: 500, currentBalance: 9_602 },
  ]

  it('returns one row per (owner, pot) that actually has an account — not all six possible combinations', () => {
    const rows = resolveContributionBreakdown({ year: 2026, accounts, changes: [] })
    expect(rows).toHaveLength(4)
    expect(rows.some((r) => r.owner === 'person_a' && r.potCategory === 'cash')).toBe(false) // no such account
  })

  it('reflects each account\'s base monthly figure when there are no changes yet', () => {
    const rows = resolveContributionBreakdown({ year: 2026, accounts, changes: [] })
    const personAInvestments = rows.find((r) => r.owner === 'person_a' && r.potCategory === 'investments')!
    expect(personAInvestments.monthly).toBe(25)
    expect(personAInvestments.annualBonus).toBe(0)
  })

  it("one owner's change never leaks into another owner's row for the same pot", () => {
    const changes: OwnerScopedContributionChange[] = [
      { owner: 'person_b', potCategory: 'investments', effectiveYear: 2026, changeType: 'set', value: 2_500 },
    ]
    const rows = resolveContributionBreakdown({ year: 2026, accounts, changes })
    expect(rows.find((r) => r.owner === 'person_b' && r.potCategory === 'investments')!.monthly).toBe(2_500)
    expect(rows.find((r) => r.owner === 'person_a' && r.potCategory === 'investments')!.monthly).toBe(25) // untouched
  })

  it('surfaces monthly and annual bonus for the same row independently', () => {
    const changes: OwnerScopedContributionChange[] = [
      { owner: 'joint', potCategory: 'cash', effectiveYear: 2026, changeType: 'set', value: 600 },
      { owner: 'joint', potCategory: 'cash', effectiveYear: 2026, changeType: 'annual_bonus', value: 1_500 },
    ]
    const rows = resolveContributionBreakdown({ year: 2026, accounts, changes })
    const jointCash = rows.find((r) => r.owner === 'joint' && r.potCategory === 'cash')!
    expect(jointCash.monthly).toBe(600)
    expect(jointCash.annualBonus).toBe(1_500)
  })

  it('resolves a future year through the schedule, same as the main projection would', () => {
    const changes: OwnerScopedContributionChange[] = [
      { owner: 'person_a', potCategory: 'investments', effectiveYear: 2028, changeType: 'set', value: 100 },
    ]
    const rows2027 = resolveContributionBreakdown({ year: 2027, accounts, changes })
    const rows2028 = resolveContributionBreakdown({ year: 2028, accounts, changes })
    expect(rows2027.find((r) => r.owner === 'person_a' && r.potCategory === 'investments')!.monthly).toBe(25)
    expect(rows2028.find((r) => r.owner === 'person_a' && r.potCategory === 'investments')!.monthly).toBe(100)
  })
})

describe('projectScheduledYearly rateOverrides', () => {
  const pots: ScheduledPlanInput['pots'] = {
    pension: { balance: 10_000, rate: 0.07, baseMonthly: 0 },
    investments: { balance: 10_000, rate: 0.07, baseMonthly: 0 },
    cash: { balance: 10_000, rate: 0.045, baseMonthly: 0 },
  }

  it('omitting rateOverrides entirely is a no-op — identical to today\'s existing behaviour', () => {
    const withField = projectScheduledYearly({
      startYear: 2026,
      age: 30,
      targetAge: 33,
      pots,
      changes: [],
      events: [],
    })
    const withoutField: Omit<ScheduledPlanInput, 'rateOverrides'> = {
      startYear: 2026,
      age: 30,
      targetAge: 33,
      pots,
      changes: [],
      events: [],
    }
    const withUndefined = projectScheduledYearly({ ...withoutField, rateOverrides: undefined })
    expect(withUndefined).toEqual(withField)
  })

  it('an override entry for one pot/year never touches any other pot or year', () => {
    const overridden = projectScheduledYearly({
      startYear: 2026,
      age: 30,
      targetAge: 32,
      pots,
      changes: [],
      events: [],
      rateOverrides: { investments: new Map([[2027, -0.2]]) }, // only investments, only 2027
    })
    const plain = projectScheduledYearly({ startYear: 2026, age: 30, targetAge: 32, pots, changes: [], events: [] })
    // pension and cash are untouched in every year, at every pot
    expect(overridden.find((p) => p.calendarYear === 2027)!.pension).toEqual(
      plain.find((p) => p.calendarYear === 2027)!.pension,
    )
    expect(overridden.find((p) => p.calendarYear === 2027)!.cash).toEqual(
      plain.find((p) => p.calendarYear === 2027)!.cash,
    )
    expect(overridden.find((p) => p.calendarYear === 2028)!.pension).toEqual(
      plain.find((p) => p.calendarYear === 2028)!.pension,
    )
    expect(overridden.find((p) => p.calendarYear === 2028)!.cash).toEqual(
      plain.find((p) => p.calendarYear === 2028)!.cash,
    )
  })

  it('a negative override rate actually shrinks the pot that year, growth included', () => {
    const overridden = projectScheduledYearly({
      startYear: 2026,
      age: 30,
      targetAge: 31,
      pots,
      changes: [],
      events: [],
      rateOverrides: { investments: new Map([[2027, -0.2]]) },
    })
    const y1 = overridden.find((p) => p.calendarYear === 2027)!
    expect(y1.investments.growth).toBeLessThan(0)
    expect(y1.investments.endValue).toBeLessThan(10_000)
  })

  it('the rate is resolved fresh every year — a one-year override does not linger', () => {
    const overridden = projectScheduledYearly({
      startYear: 2026,
      age: 30,
      targetAge: 32,
      pots,
      changes: [],
      events: [],
      rateOverrides: { investments: new Map([[2027, -0.2]]) },
    })
    const plain = projectScheduledYearly({ startYear: 2026, age: 30, targetAge: 32, pots, changes: [], events: [] })
    // 2028 has no override entry, so growth resumes at the normal 7% —
    // the only difference from plain is a lower starting balance carried
    // forward from 2027's stress year
    expect(overridden.find((p) => p.calendarYear === 2028)!.investments.growth).toBeGreaterThan(0)
    expect(overridden.find((p) => p.calendarYear === 2028)!.investments.endValue).toBeLessThan(
      plain.find((p) => p.calendarYear === 2028)!.investments.endValue,
    )
  })
})

describe('findScheduledCrossoverYear', () => {
  const pots: ScheduledPlanInput['pots'] = {
    pension: { balance: 0, rate: 0.07, baseMonthly: 0 },
    investments: { balance: 200_000, rate: 0.07, baseMonthly: 100 },
    cash: { balance: 0, rate: 0.045, baseMonthly: 0 },
  }

  it('finds the first calendar year growth outpaces that year\'s contribution', () => {
    const points = projectScheduledYearly({
      startYear: 2026,
      age: 30,
      targetAge: 60,
      pots,
      changes: [],
      events: [],
    })
    const year = findScheduledCrossoverYear(points)
    expect(year).not.toBeNull()
    const point = points.find((p) => p.calendarYear === year)!
    expect(point.total.growth).toBeGreaterThan(point.total.contribution)
    // every earlier year (excluding the all-zero seed point) hadn't crossed yet
    for (const p of points) {
      if (p.calendarYear >= 2027 && p.calendarYear < year!) {
        expect(p.total.growth).toBeLessThanOrEqual(p.total.contribution)
      }
    }
  })

  it('never crosses over (returns null) when there is nothing invested and nothing contributed', () => {
    const points = projectScheduledYearly({
      startYear: 2026,
      age: 30,
      targetAge: 35,
      pots: { pension: { balance: 0, rate: 0.07, baseMonthly: 0 }, investments: { balance: 0, rate: 0.07, baseMonthly: 0 }, cash: { balance: 0, rate: 0.045, baseMonthly: 0 } },
      changes: [],
      events: [],
    })
    expect(findScheduledCrossoverYear(points)).toBeNull()
  })

  it('ignores the all-zero seed point at index 0', () => {
    const points = projectScheduledYearly({ startYear: 2026, age: 30, targetAge: 30, pots, changes: [], events: [] })
    expect(points).toHaveLength(1) // just the seed point, no horizon
    expect(findScheduledCrossoverYear(points)).toBeNull()
  })
})

describe('buildScheduledPlanInput', () => {
  const household = { realReturn: 0.07, cashReturn: 0.045 }
  const people = [{ age: 30, retirementAge: 60 }]
  const accounts: ScheduledPlanAccount[] = [
    { owner: 'person_a', potCategory: 'investments', monthlyContribution: 500, currentBalance: 10_000 },
  ]

  it('resolves the same input buildScheduledPlan projects from', () => {
    const input = buildScheduledPlanInput({
      owner: 'total',
      startYear: 2026,
      people,
      household,
      accounts,
      changes: [],
      events: [],
    })!
    const viaHelper = projectScheduledYearly(input)
    const viaBuildScheduledPlan = buildScheduledPlan({
      owner: 'total',
      startYear: 2026,
      people,
      household,
      accounts,
      changes: [],
      events: [],
    })!
    expect(viaHelper).toEqual(viaBuildScheduledPlan)
  })

  it('returns null under the same conditions buildScheduledPlan does', () => {
    expect(
      buildScheduledPlanInput({ owner: 'person_b', startYear: 2026, people, household, accounts, changes: [], events: [] }),
    ).toBeNull()
  })
})

describe('buildScheduledForecastYearRows', () => {
  const checkpoint = {
    investedRate: 0.07,
    cashRate: 0.045,
    total: {
      age: 30,
      targetAge: 33,
      pension: 0,
      stocks: 10_000,
      cash: 0,
      monthly: 500,
      pensionMonthly: 0,
      cashMonthly: 0,
    },
    personA: null,
    personB: null,
    joint: { age: 30, targetAge: 33, pension: 0, stocks: 0, cash: 0, monthly: 0, pensionMonthly: 0, cashMonthly: 0 },
  }

  it('anchors the projection to the checkpoint\'s own creation year, not today', () => {
    const rows = buildScheduledForecastYearRows({
      checkpoint: { ...checkpoint, contributionChanges: [], plannedEvents: [] },
      checkpointCreatedAt: '2026-03-15T00:00:00.000Z',
      owner: 'total',
      accounts: [],
      snapshots: [],
      currentCalendarYear: 2026,
      pot: 'total',
    })!
    expect(rows[0]!.calendarYear).toBe(2026)
    expect(rows.at(-1)!.calendarYear).toBe(2029)
  })

  it('originalValue is always null — this is a different comparison from the replan-fork model', () => {
    const rows = buildScheduledForecastYearRows({
      checkpoint: { ...checkpoint, contributionChanges: [], plannedEvents: [] },
      checkpointCreatedAt: '2026-01-01T00:00:00.000Z',
      owner: 'total',
      accounts: [],
      snapshots: [],
      currentCalendarYear: 2026,
      pot: 'total',
    })!
    expect(rows.every((r) => r.originalValue === null)).toBe(true)
  })

  it('a change scheduled after checkpoint save shows up in the replayed forecast', () => {
    const changes: OwnerScopedContributionChange[] = [
      { owner: 'joint', potCategory: 'investments', effectiveYear: 2028, changeType: 'set', value: 2_000 },
    ]
    const rows = buildScheduledForecastYearRows({
      checkpoint: { ...checkpoint, contributionChanges: changes, plannedEvents: [] },
      checkpointCreatedAt: '2026-01-01T00:00:00.000Z',
      owner: 'total',
      accounts: [],
      snapshots: [],
      currentCalendarYear: 2026,
      pot: 'investments',
    })!
    expect(rows.find((r) => r.calendarYear === 2027)!.forecastAdditions).toBe(6_000) // still £500/mo
    expect(rows.find((r) => r.calendarYear === 2028)!.forecastAdditions).toBe(24_000) // now £2,000/mo
  })

  it('owner filtering scopes both the schedule and the accounts used for actuals', () => {
    const perOwnerCheckpoint = {
      ...checkpoint,
      personA: { age: 30, targetAge: 60, pension: 0, stocks: 5_000, cash: 0, monthly: 300, pensionMonthly: 0, cashMonthly: 0 },
      personB: { age: 32, targetAge: 60, pension: 0, stocks: 3_000, cash: 0, monthly: 200, pensionMonthly: 0, cashMonthly: 0 },
    }
    const changes: OwnerScopedContributionChange[] = [
      { owner: 'person_a', potCategory: 'investments', effectiveYear: 2027, changeType: 'set', value: 900 },
      { owner: 'person_b', potCategory: 'investments', effectiveYear: 2027, changeType: 'set', value: 100 },
    ]
    const rows = buildScheduledForecastYearRows({
      checkpoint: { ...perOwnerCheckpoint, contributionChanges: changes, plannedEvents: [] },
      checkpointCreatedAt: '2026-01-01T00:00:00.000Z',
      owner: 'person_a',
      accounts: [],
      snapshots: [],
      currentCalendarYear: 2026,
      pot: 'investments',
    })!
    expect(rows.find((r) => r.calendarYear === 2027)!.forecastAdditions).toBe(900 * 12) // not person_b's 100
  })

  it('returns null for a person who does not exist in the checkpoint', () => {
    const rows = buildScheduledForecastYearRows({
      checkpoint: { ...checkpoint, contributionChanges: [], plannedEvents: [] },
      checkpointCreatedAt: '2026-01-01T00:00:00.000Z',
      owner: 'person_a', // personA is null on this fixture
      accounts: [],
      snapshots: [],
      currentCalendarYear: 2026,
      pot: 'total',
    })
    expect(rows).toBeNull()
  })

  it('populates actuals only for past years, from real account snapshots', () => {
    const rows = buildScheduledForecastYearRows({
      checkpoint: { ...checkpoint, contributionChanges: [], plannedEvents: [] },
      checkpointCreatedAt: '2026-01-01T00:00:00.000Z',
      owner: 'total',
      accounts: [{ id: 'acc-1', potCategory: 'investments', owner: 'joint' }],
      snapshots: [
        {
          accountId: 'acc-1',
          year: 2027,
          recordedAt: '2027-06-01T00:00:00.000Z',
          startBalance: 10_000,
          endBalance: 16_000,
          moneyIn: 6_000,
          transferOut: null,
        },
      ],
      currentCalendarYear: 2027,
      pot: 'total',
    })!
    const past = rows.find((r) => r.calendarYear === 2027)!
    expect(past.actualValue).toBe(16_000)
    expect(past.actualAdditions).toBe(6_000)
    const future = rows.find((r) => r.calendarYear === 2029)!
    expect(future.actualValue).toBeNull()
    expect(future.actualAdditions).toBeNull()
  })
})
