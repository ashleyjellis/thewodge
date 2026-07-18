import { describe, expect, it } from 'vitest'
import { employerMatchValue, personalAllowanceTrap } from './education'

describe('personalAllowanceTrap (spec §3, §9)', () => {
  it('flags income inside the £100k–£125,140 band at a ~60% marginal rate', () => {
    const t = personalAllowanceTrap(110_000, 0, 0)
    expect(t.adjustedNetIncome).toBe(110_000)
    expect(t.inTrap).toBe(true)
    expect(t.personalAllowanceLost).toBe(5_000) // (110k − 100k) / 2
    expect(t.amountInBand).toBe(10_000)
    expect(t.effectiveMarginalRate).toBeCloseTo(0.6, 6)
    expect(t.sacrificeToClear).toBe(10_000)
  })

  it('caps the lost allowance once past £125,140', () => {
    const t = personalAllowanceTrap(130_000, 0, 0)
    expect(t.inTrap).toBe(false)
    expect(t.personalAllowanceLost).toBe(12_570) // fully withdrawn, capped
    expect(t.amountInBand).toBe(25_140) // width of the band
    expect(t.effectiveMarginalRate).toBe(0)
    expect(t.sacrificeToClear).toBe(30_000)
  })

  it('counts pension sacrifice against adjusted net income', () => {
    const t = personalAllowanceTrap(120_000, 15_000, 20_000)
    expect(t.adjustedNetIncome).toBe(115_000)
    expect(t.inTrap).toBe(true)
    expect(t.personalAllowanceLost).toBe(7_500)
    expect(t.sacrificeToClear).toBe(15_000)
  })

  it('is clear below £100k', () => {
    const t = personalAllowanceTrap(90_000, 0, 0)
    expect(t.inTrap).toBe(false)
    expect(t.personalAllowanceLost).toBe(0)
    expect(t.amountInBand).toBe(0)
    expect(t.sacrificeToClear).toBe(0)
  })
})

describe('employerMatchValue (spec §3)', () => {
  it('values the employer contribution as annual free money', () => {
    const m = employerMatchValue(90_000, {
      userPct: 0.05,
      matchPct: 0.05,
      additionalPct: 0.03,
    })
    expect(m.matchAnnual).toBe(4_500)
    expect(m.additionalAnnual).toBe(2_700)
    expect(m.employerAnnual).toBe(7_200)
    expect(m.employeeAnnual).toBe(4_500)
    expect(m.totalAnnual).toBe(11_700)
  })
})
