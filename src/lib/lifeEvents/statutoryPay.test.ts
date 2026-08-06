import { describe, expect, it } from 'vitest'
import { calculateStatutoryPay, STATUTORY_WEEKLY_RATE } from './statutoryPay'

describe('calculateStatutoryPay', () => {
  it('a high earner is capped at the flat statutory rate for the lower-rate weeks', () => {
    const result = calculateStatutoryPay(80_000, 'maternity')
    expect(result.averageWeeklyEarnings).toBeCloseTo(80_000 / 52, 5)
    expect(result.higherRateWeeklyPay).toBeCloseTo((80_000 / 52) * 0.9, 5)
    // 90% AWE comfortably exceeds the flat rate at this salary
    expect(result.lowerRateWeeklyPay).toBe(STATUTORY_WEEKLY_RATE)
  })

  it('a low earner never gets bumped up to the flat rate — 90% AWE applies if it is lower', () => {
    const result = calculateStatutoryPay(10_000, 'maternity')
    const awe = 10_000 / 52
    expect(result.lowerRateWeeklyPay).toBeCloseTo(awe * 0.9, 5)
    expect(result.lowerRateWeeklyPay).toBeLessThan(STATUTORY_WEEKLY_RATE)
  })

  it('maternity pays 39 weeks total (6 higher-rate + 33 lower-rate)', () => {
    const result = calculateStatutoryPay(40_000, 'maternity')
    expect(result.paidWeeks).toBe(39)
  })

  it('paternity pays 2 weeks total, all at the lower-of rate — no higher-rate tier', () => {
    const result = calculateStatutoryPay(40_000, 'paternity')
    expect(result.paidWeeks).toBe(2)
    expect(result.totalStatutoryPay).toBeCloseTo(2 * result.lowerRateWeeklyPay, 5)
  })

  it('blended weekly pay is the true weighted average across both tiers, not a simple mean', () => {
    const result = calculateStatutoryPay(80_000, 'maternity')
    const expectedBlend =
      (6 * result.higherRateWeeklyPay + 33 * result.lowerRateWeeklyPay) / 39
    expect(result.blendedWeeklyPay).toBeCloseTo(expectedBlend, 5)
    // the flat-capped lower tier dominates 33 of 39 weeks, so the blend
    // sits well below the higher-rate figure
    expect(result.blendedWeeklyPay).toBeLessThan(result.higherRateWeeklyPay)
  })

  it('blended monthly pay is the blended weekly figure annualised then divided by 12', () => {
    const result = calculateStatutoryPay(40_000, 'maternity')
    expect(result.blendedMonthlyPay).toBeCloseTo((result.blendedWeeklyPay * 52) / 12, 5)
  })

  it('a zero or negative salary clamps to zero rather than going negative', () => {
    const zero = calculateStatutoryPay(0, 'maternity')
    const negative = calculateStatutoryPay(-5_000, 'maternity')
    expect(zero.averageWeeklyEarnings).toBe(0)
    expect(zero.blendedMonthlyPay).toBe(0)
    expect(negative.averageWeeklyEarnings).toBe(0)
    expect(negative.blendedMonthlyPay).toBe(0)
  })

  it('statutory pay never exceeds 90% of normal income — a real income drop, always', () => {
    const highEarner = calculateStatutoryPay(120_000, 'maternity')
    const normalMonthly = 120_000 / 12
    expect(highEarner.blendedMonthlyPay).toBeLessThan(normalMonthly * 0.9)
  })
})
