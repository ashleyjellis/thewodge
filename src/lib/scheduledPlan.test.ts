import { describe, expect, it } from 'vitest'
import {
  projectScheduledYearly,
  resolveMonthlySchedule,
  type ContributionChange,
  type PlannedEvent,
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
