import { describe, expect, it } from 'vitest'
import { checkBridge } from './bridgeCheck'

describe('checkBridge', () => {
  it('covers when the investments pot is at or above the required value', () => {
    const result = checkBridge({ investmentsValue: 1_000_000, targetIncomeToday: 40_000, swr: 0.04 })
    expect(result.requiredValue).toBe(1_000_000) // 40,000 / 0.04
    expect(result.covers).toBe(true)
  })

  it('is exactly on the boundary — equal counts as covering, not just strictly above', () => {
    const result = checkBridge({ investmentsValue: 1_000_000, targetIncomeToday: 40_000, swr: 0.04 })
    expect(result.investmentsValue).toBe(result.requiredValue)
    expect(result.covers).toBe(true)
  })

  it('does not cover when the investments pot falls short', () => {
    const result = checkBridge({ investmentsValue: 900_000, targetIncomeToday: 40_000, swr: 0.04 })
    expect(result.covers).toBe(false)
  })

  it('never covers when there is no investments value to check (age outside the projected horizon)', () => {
    const result = checkBridge({ investmentsValue: null, targetIncomeToday: 40_000, swr: 0.04 })
    expect(result.covers).toBe(false)
    expect(result.investmentsValue).toBeNull()
  })

  it('a lower safe withdrawal rate demands a bigger pot for the same target income', () => {
    const conservative = checkBridge({ investmentsValue: 1_000_000, targetIncomeToday: 40_000, swr: 0.03 })
    const aggressive = checkBridge({ investmentsValue: 1_000_000, targetIncomeToday: 40_000, swr: 0.05 })
    expect(conservative.requiredValue).toBeGreaterThan(aggressive.requiredValue)
    expect(conservative.covers).toBe(false) // 40,000 / 0.03 ≈ 1.33m, short of the 1m pot
    expect(aggressive.covers).toBe(true) // 40,000 / 0.05 = 800k, comfortably covered
  })

  it('degrades a non-positive swr to "impossible to cover" rather than dividing into nonsense', () => {
    const result = checkBridge({ investmentsValue: 1_000_000, targetIncomeToday: 40_000, swr: 0 })
    expect(result.requiredValue).toBe(Infinity)
    expect(result.covers).toBe(false)
  })
})
