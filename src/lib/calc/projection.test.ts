import { describe, expect, it } from 'vitest'
import {
  combineProjections,
  projectPot,
  projectedValue,
} from './projection'
import type { Pot } from './types'

describe('projectPot (spec §3.3, §3.4)', () => {
  // pot: £1,000 today, £100/yr contribution, 10% real, 2 years — hand-computed.
  const pot: Pot = { value: 1_000, monthly: 0, annualLump: 100 }
  const points = projectPot(pot, 0.1, 2)

  it('starts at today with no contribution or growth', () => {
    expect(points[0]).toMatchObject({
      year: 0,
      startValue: 1_000,
      contribution: 0,
      growth: 0,
      endValue: 1_000,
    })
  })

  it('applies next = (prev + contribution) * (1 + r)', () => {
    // year 1: (1000 + 100) * 1.1 = 1210, growth 110
    expect(points[1]).toMatchObject({
      year: 1,
      startValue: 1_000,
      contribution: 100,
      endValue: 1_210,
    })
    expect(points[1]!.growth).toBeCloseTo(110, 6)
    // year 2: (1210 + 100) * 1.1 = 1441, growth 131
    expect(points[2]!.endValue).toBeCloseTo(1_441, 6)
    expect(points[2]!.growth).toBeCloseTo(131, 6)
  })

  it('keeps the invariant end = start + Σcontribution + Σgrowth', () => {
    const last = points[points.length - 1]!
    expect(last.endValue).toBeCloseTo(
      pot.value + last.cumulativeContribution + last.cumulativeGrowth,
      6,
    )
    expect(last.cumulativeContribution).toBe(200)
    expect(last.cumulativeGrowth).toBeCloseTo(241, 6)
  })

  it('splits each year into contribution vs market-growth shares', () => {
    // year 1 increase = 100 + 110 = 210
    expect(points[1]!.contributionShare).toBeCloseTo(100 / 210, 6)
    expect(points[1]!.growthShare).toBeCloseTo(110 / 210, 6)
    expect(
      points[1]!.contributionShare + points[1]!.growthShare,
    ).toBeCloseTo(1, 6)
  })

  it('honours a per-year contribution override (freeze at a chosen year)', () => {
    const frozen = projectPot(pot, 0.1, 2, {
      contributionForYear: (y) => (y <= 1 ? 100 : 0),
    })
    // year 2 now contributes nothing: (1210 + 0) * 1.1 = 1331
    expect(frozen[2]!.contribution).toBe(0)
    expect(frozen[2]!.endValue).toBeCloseTo(1_331, 6)
  })
})

describe('projectedValue', () => {
  it('equals the final projection point', () => {
    const pot: Pot = { value: 5_000, monthly: 100, annualLump: 0 }
    const points = projectPot(pot, 0.07, 10)
    expect(projectedValue(pot, 0.07, 10)).toBeCloseTo(
      points[points.length - 1]!.endValue,
      6,
    )
  })
})

describe('combineProjections', () => {
  it('sums two pot series point by point', () => {
    const a: Pot = { value: 1_000, monthly: 0, annualLump: 100 }
    const b: Pot = { value: 2_000, monthly: 0, annualLump: 200 }
    const combined = combineProjections([
      projectPot(a, 0.1, 2),
      projectPot(b, 0.1, 2),
    ])
    // year 1: a=1210, b=(2200)*1.1=2420 → 3630
    expect(combined[1]!.endValue).toBeCloseTo(3_630, 6)
    expect(combined[0]!.endValue).toBe(3_000)
    expect(combined[2]!.cumulativeContribution).toBe(600) // 200 + 400
  })

  it('returns empty for no series', () => {
    expect(combineProjections([])).toEqual([])
  })
})
