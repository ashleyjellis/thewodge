import { describe, expect, it } from 'vitest'
import {
  coastFiNumber,
  coastFiStatus,
  fiNumber,
  yearsToRetirement,
} from './fi'
import type { Pot } from './types'

describe('fiNumber', () => {
  it('is target income divided by the safe withdrawal rate (spec §3.1)', () => {
    // £70,000 / 0.04 = £1,750,000 — the anchor figure from the source case.
    expect(fiNumber(70_000, 0.04)).toBe(1_750_000)
  })

  it('scales with the withdrawal rate', () => {
    expect(fiNumber(40_000, 0.04)).toBe(1_000_000)
    expect(fiNumber(70_000, 0.035)).toBeCloseTo(2_000_000, 6)
  })

  it('rejects a non-positive SWR', () => {
    expect(() => fiNumber(70_000, 0)).toThrow()
    expect(() => fiNumber(70_000, -0.01)).toThrow()
  })
})

describe('coastFiNumber (spec §3.2)', () => {
  it('discounts the FI number back over the years to retirement', () => {
    // 24 years at 7% real: £1,750,000 / 1.07^24 ≈ £345,007.
    expect(Math.round(coastFiNumber(1_750_000, 0.07, 24))).toBe(345_007)
  })

  it('reproduces the spec headline figure at the rate it was actually computed', () => {
    // The spec quotes ≈ £432,000 for 24 years; that is the 6% discount, not 7%.
    expect(Math.round(coastFiNumber(1_750_000, 0.06, 24))).toBe(432_212)
  })

  it('is a plain compound discount', () => {
    expect(coastFiNumber(100, 0.1, 2)).toBeCloseTo(82.6446, 4)
    // zero years to go: you already need the whole FI number today.
    expect(coastFiNumber(1_750_000, 0.07, 0)).toBe(1_750_000)
  })
})

describe('yearsToRetirement', () => {
  it('never goes negative', () => {
    expect(yearsToRetirement(34, 58)).toBe(24)
    expect(yearsToRetirement(60, 58)).toBe(0)
  })
})

describe('coastFiStatus', () => {
  const fi = 1_750_000
  const r = 0.07

  it('flags a pension that already clears the coast number as self-sustaining', () => {
    // coast over 24y ≈ £345k; a £400k pot already coasts.
    const pot: Pot = { value: 400_000, monthly: 0, annualLump: 0 }
    const status = coastFiStatus(pot, fi, r, 24)
    expect(status.coasting).toBe(true)
    expect(status.yearsToCoast).toBe(0)
    expect(status.surplus).toBeGreaterThan(0)
    expect(status.progress).toBe(1)
  })

  it('reports years-to-coast for a pot still short of the bar', () => {
    // years-to-coast is the earliest year you could STOP contributing and still
    // reach FI by retirement — a pot with a healthy contribution reaches it.
    const pot: Pot = { value: 250_000, monthly: 2_500, annualLump: 0 }
    const status = coastFiStatus(pot, fi, r, 24)
    expect(status.coasting).toBe(false)
    expect(status.progress).toBeLessThan(1)
    expect(status.yearsToCoast).toBe(4)
  })

  it('returns null years-to-coast when even full contributions miss FI', () => {
    // £120k + £1,500/mo over 24y lands just under FI, so there is no year you
    // could stop and still get there.
    const pot: Pot = { value: 120_000, monthly: 1_500, annualLump: 0 }
    const status = coastFiStatus(pot, fi, r, 24)
    expect(status.coasting).toBe(false)
    expect(status.yearsToCoast).toBeNull()
  })
})
