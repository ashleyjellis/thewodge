import { describe, expect, it } from 'vitest'
import { calculateMarginalValue } from './marginalValue'
import { futureValueContributions, futureValueLump, monthlyRate } from './forecast'

describe('calculateMarginalValue', () => {
  it('monthly mode matches futureValueContributions directly, contributed = amount × months', () => {
    const result = calculateMarginalValue({ amount: 10, mode: 'monthly', annualRate: 0.07, months: 120 })
    const m = monthlyRate(0.07)
    expect(result.futureValue).toBeCloseTo(futureValueContributions(10, m, 120), 6)
    expect(result.totalContributed).toBe(1200)
    expect(result.growth).toBeCloseTo(result.futureValue - 1200, 6)
  })

  it('lump mode matches futureValueLump directly, contributed = the amount itself, not × months', () => {
    const result = calculateMarginalValue({ amount: 500, mode: 'lump', annualRate: 0.07, months: 120 })
    const m = monthlyRate(0.07)
    expect(result.futureValue).toBeCloseTo(futureValueLump(500, m, 120), 6)
    expect(result.totalContributed).toBe(500)
    expect(result.growth).toBeCloseTo(result.futureValue - 500, 6)
  })

  it('growth is always positive over a real horizon at a real positive rate', () => {
    const monthly = calculateMarginalValue({ amount: 10, mode: 'monthly', annualRate: 0.07, months: 240 })
    const lump = calculateMarginalValue({ amount: 500, mode: 'lump', annualRate: 0.07, months: 240 })
    expect(monthly.growth).toBeGreaterThan(0)
    expect(lump.growth).toBeGreaterThan(0)
  })

  it('zero months means no growth and no contribution at all', () => {
    const result = calculateMarginalValue({ amount: 10, mode: 'monthly', annualRate: 0.07, months: 0 })
    expect(result.futureValue).toBe(0)
    expect(result.totalContributed).toBe(0)
    expect(result.growth).toBe(0)
  })

  it('clamps a negative months to zero rather than producing a nonsense negative horizon', () => {
    const result = calculateMarginalValue({ amount: 10, mode: 'monthly', annualRate: 0.07, months: -12 })
    expect(result.months).toBe(0)
    expect(result.futureValue).toBe(0)
  })

  it('a longer horizon always grows the marginal value further, both modes', () => {
    const shortMonthly = calculateMarginalValue({ amount: 10, mode: 'monthly', annualRate: 0.07, months: 60 })
    const longMonthly = calculateMarginalValue({ amount: 10, mode: 'monthly', annualRate: 0.07, months: 240 })
    expect(longMonthly.futureValue).toBeGreaterThan(shortMonthly.futureValue)

    const shortLump = calculateMarginalValue({ amount: 500, mode: 'lump', annualRate: 0.07, months: 60 })
    const longLump = calculateMarginalValue({ amount: 500, mode: 'lump', annualRate: 0.07, months: 240 })
    expect(longLump.futureValue).toBeGreaterThan(shortLump.futureValue)
  })

  it('a zero rate means growth is exactly zero — future value equals what was put in', () => {
    const monthly = calculateMarginalValue({ amount: 10, mode: 'monthly', annualRate: 0, months: 120 })
    expect(monthly.futureValue).toBeCloseTo(1200, 6)
    expect(monthly.growth).toBeCloseTo(0, 6)

    const lump = calculateMarginalValue({ amount: 500, mode: 'lump', annualRate: 0, months: 120 })
    expect(lump.futureValue).toBeCloseTo(500, 6)
    expect(lump.growth).toBeCloseTo(0, 6)
  })
})
