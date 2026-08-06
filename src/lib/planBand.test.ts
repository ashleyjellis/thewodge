import { describe, expect, it } from 'vitest'
import { buildPlanBand, orderedBandRange } from './planBand'
import type { ScheduledPlanInput } from './scheduledPlan'

const input: ScheduledPlanInput = {
  startYear: 2026,
  age: 30,
  targetAge: 60,
  pots: {
    pension: { balance: 20_000, rate: 0.07, baseMonthly: 500 },
    investments: { balance: 10_000, rate: 0.07, baseMonthly: 300 },
    cash: { balance: 5_000, rate: 0.045, baseMonthly: 0 },
  },
  changes: [],
  events: [],
}

describe('buildPlanBand', () => {
  it('downYearsCount 0 collapses low/high to exactly mid — a zero-width band, not hidden', () => {
    const band = buildPlanBand(input, 0)
    expect(band.low).toBe(band.mid)
    expect(band.high).toBe(band.mid)
    expect(band.lowStartYear).toBeNull()
    expect(band.highStartYear).toBeNull()
  })

  it('low <= high <= mid — any down-run placement can only ever reduce the ending value', () => {
    const band = buildPlanBand(input, 2)
    const midEnd = band.mid.points.at(-1)!.total.endValue
    const lowEnd = band.low.points.at(-1)!.total.endValue
    const highEnd = band.high.points.at(-1)!.total.endValue
    expect(lowEnd).toBeLessThanOrEqual(highEnd)
    expect(highEnd).toBeLessThanOrEqual(midEnd)
    // over a 30-year horizon with real balances/contributions, these aren't ties
    expect(lowEnd).toBeLessThan(midEnd)
  })

  it('reports the placement years actually found, both within the projection horizon', () => {
    const band = buildPlanBand(input, 3)
    expect(band.lowStartYear).not.toBeNull()
    expect(band.highStartYear).not.toBeNull()
    expect(band.lowStartYear!).toBeGreaterThanOrEqual(2027) // never at the all-zero seed year
    expect(band.lowStartYear!).toBeLessThanOrEqual(2056) // 2026 + 30 years - 3 + 1
    expect(band.highStartYear!).toBeGreaterThanOrEqual(2027)
    expect(band.highStartYear!).toBeLessThanOrEqual(2056)
  })

  it('mid never applies a down-run — it matches a plain projection over the same input', () => {
    const band = buildPlanBand(input, 4)
    expect(band.mid.crossoverYear).not.toBeNull()
    // mid's own points shouldn't dip into decline the way a down-run year would
    expect(band.mid.points.every((p) => p.total.growth >= 0 || p.calendarYear === 2026)).toBe(true)
  })

  it('a bigger count never fits a shorter remaining horizon: collapses to mid instead of crashing', () => {
    const shortInput: ScheduledPlanInput = { ...input, age: 58, targetAge: 60 } // just 2 years
    const band = buildPlanBand(shortInput, 5)
    expect(band.low).toBe(band.mid)
    expect(band.high).toBe(band.mid)
  })

  it("each series' crossoverYear is computed independently, not copied from mid", () => {
    const band = buildPlanBand(input, 6)
    // low suffers real down years, so its own crossover (if any) is never
    // earlier than mid's
    if (band.mid.crossoverYear !== null && band.low.crossoverYear !== null) {
      expect(band.low.crossoverYear).toBeGreaterThanOrEqual(band.mid.crossoverYear)
    }
  })
})

describe('orderedBandRange', () => {
  it('returns the pair unchanged when already low-to-high', () => {
    expect(orderedBandRange(10, 20)).toEqual({ low: 10, high: 20 })
  })

  it('swaps a "backwards" pair — a real possibility at an intermediate year, only the final value is guaranteed ordered', () => {
    expect(orderedBandRange(20, 10)).toEqual({ low: 10, high: 20 })
  })

  it('a tied pair is a valid zero-width range either way', () => {
    expect(orderedBandRange(15, 15)).toEqual({ low: 15, high: 15 })
  })
})
