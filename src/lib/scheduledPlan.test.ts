import { describe, expect, it } from 'vitest'
import {
  buildScheduledPlan,
  projectScheduledYearly,
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
})

describe('buildScheduledPlan', () => {
  const household = { retirementAge: 60, realReturn: 0.07, cashReturn: 0.045 }
  const people = [{ age: 30 }, { age: 32 }]
  const accounts: ScheduledPlanAccount[] = [
    { owner: 'person_a', potCategory: 'investments', monthlyContribution: 500, currentBalance: 10_000 },
    { owner: 'person_b', potCategory: 'investments', monthlyContribution: 300, currentBalance: 4_000 },
    { owner: 'joint', potCategory: 'cash', monthlyContribution: 0, currentBalance: 2_000 },
  ]

  it('returns null for a person who does not exist yet', () => {
    const result = buildScheduledPlan({
      owner: 'person_b',
      startYear: 2026,
      people: [{ age: 30 }], // only person_a exists
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
      household: { retirementAge: 35, realReturn: 0.5, cashReturn: 0 }, // exaggerated to make the split obvious
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
