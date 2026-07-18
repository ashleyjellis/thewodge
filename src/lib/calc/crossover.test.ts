import { describe, expect, it } from 'vitest'
import { crossoverYear } from './crossover'
import { projectPot } from './projection'
import type { Pot } from './types'

describe('crossoverYear (spec §3.5)', () => {
  const pot: Pot = { value: 100_000, monthly: 1_000, annualLump: 0 }
  const r = 0.07
  const years = 40

  it('finds the first year market growth overtakes contributions', () => {
    const x = crossoverYear(pot, r, years)
    expect(x.year).not.toBeNull()
    expect(x.growthAtCrossover!).toBeGreaterThan(x.contributionAtCrossover!)

    // the year before the crossover must NOT yet have crossed
    const points = projectPot(pot, r, years)
    const before = points[x.year! - 1]!
    expect(before.growth).toBeLessThanOrEqual(before.contribution)
  })

  it('labels the calendar year when a base year is given', () => {
    const x = crossoverYear(pot, r, years, 2025)
    expect(x.calendarYear).toBe(2025 + x.year!)
  })

  it('crosses immediately when the pot is already large', () => {
    const big: Pot = { value: 5_000_000, monthly: 1_000, annualLump: 0 }
    expect(crossoverYear(big, r, years).year).toBe(1)
  })

  it('never crosses with zero growth', () => {
    const flat: Pot = { value: 100_000, monthly: 1_000, annualLump: 0 }
    const x = crossoverYear(flat, 0, years)
    expect(x.year).toBeNull()
    expect(x.calendarYear).toBeNull()
  })
})
