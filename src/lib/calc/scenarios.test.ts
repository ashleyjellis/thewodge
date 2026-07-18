import { describe, expect, it } from 'vitest'
import {
  bridgeCheck,
  earliestFiAge,
  requiredBridgePot,
  stopAtScenario,
} from './scenarios'
import { projectedValue } from './projection'
import type { Pot } from './types'

describe('stopAtScenario (spec §3.6)', () => {
  const pot: Pot = { value: 100_000, monthly: 1_000, annualLump: 0 }
  const r = 0.07

  it('freezes contributions at the chosen age and compounds to retirement', () => {
    const s = stopAtScenario(pot, r, 34, 40, 58)
    expect(s.yearsUntilStop).toBe(6)
    // still grows after the freeze, but ends below the keep-contributing path
    const keepGoing = projectedValue(pot, r, 24)
    expect(s.finalValue).toBeGreaterThan(pot.value)
    expect(s.finalValue).toBeLessThan(keepGoing)
  })

  it('coasts from today when the stop age is already reached', () => {
    const s = stopAtScenario(pot, r, 42, 40, 58)
    expect(s.yearsUntilStop).toBe(0)
    // pure compounding of the starting balance: 100k * 1.07^16
    expect(s.finalValue).toBeCloseTo(100_000 * Math.pow(1.07, 16), 4)
  })
})

describe('earliestFiAge (spec §3.9)', () => {
  it('finds the first year the pot reaches the FI number', () => {
    const pot: Pot = { value: 500_000, monthly: 3_000, annualLump: 0 }
    const fi = 1_750_000
    const e = earliestFiAge(pot, 0.07, fi, 40, 40)
    expect(e.year).not.toBeNull()
    expect(e.value!).toBeGreaterThanOrEqual(fi)
    expect(e.age).toBe(40 + e.year!)
  })

  it('returns null when the pot never reaches FI in the horizon', () => {
    const pot: Pot = { value: 10_000, monthly: 100, annualLump: 0 }
    const e = earliestFiAge(pot, 0.07, 1_750_000, 40, 10)
    expect(e.year).toBeNull()
    expect(e.age).toBeNull()
  })
})

describe('bridge check (spec §3.10)', () => {
  it('closed-form required pot matches a year-by-year simulation', () => {
    const income = 70_000
    const r = 0.07
    const n = 17 // stop at 40, pension access at 57
    const required = requiredBridgePot(income, r, n)

    // draw income at the start of each year, grow the remainder — should land ≈ 0
    let balance = required
    for (let i = 0; i < n; i++) balance = (balance - income) * (1 + r)
    expect(Math.abs(balance)).toBeLessThan(0.01)
  })

  it('degrades to income × years at zero return', () => {
    expect(requiredBridgePot(70_000, 0, 17)).toBe(70_000 * 17)
  })

  it('flags covered vs short and reports the gap', () => {
    const income = 70_000
    const r = 0.07
    const required = requiredBridgePot(income, r, 17)

    const exact = bridgeCheck(required, income, 40, r)
    expect(exact.covered).toBe(true)
    expect(exact.bridgeYears).toBe(17)
    expect(exact.surplus).toBeCloseTo(0, 2)
    expect(exact.shortfall).toBeCloseTo(0, 2)

    const short = bridgeCheck(required - 100_000, income, 40, r)
    expect(short.covered).toBe(false)
    expect(short.shortfall).toBeCloseTo(100_000, 2)

    const surplus = bridgeCheck(required + 50_000, income, 40, r)
    expect(surplus.covered).toBe(true)
    expect(surplus.surplus).toBeCloseTo(50_000, 2)
  })

  it('needs nothing when the stop age is at or past pension access', () => {
    const b = bridgeCheck(0, 70_000, 57, 0.07)
    expect(b.bridgeYears).toBe(0)
    expect(b.covered).toBe(true)
    expect(b.requiredPot).toBe(0)
  })
})
