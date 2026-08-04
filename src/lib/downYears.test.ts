import { describe, expect, it } from 'vitest'
import { downYearRateOverrides, findDownYearPlacements } from './downYears'

describe('findDownYearPlacements', () => {
  it('returns null when count is 0 or negative — "no band" is the caller\'s job to detect', () => {
    expect(
      findDownYearPlacements({ count: 0, earliestYear: 2027, latestYear: 2060, scoreStartYear: () => 0 }),
    ).toBeNull()
    expect(
      findDownYearPlacements({ count: -1, earliestYear: 2027, latestYear: 2060, scoreStartYear: () => 0 }),
    ).toBeNull()
  })

  it('returns null when the horizon is too short to fit even one placement', () => {
    // a 5-year run needs 5 consecutive years within [2027, 2029] — doesn't fit
    expect(
      findDownYearPlacements({ count: 5, earliestYear: 2027, latestYear: 2029, scoreStartYear: () => 0 }),
    ).toBeNull()
  })

  it('finds the worst- and best-scoring placement across every feasible start year', () => {
    // a synthetic score: worst at 2030, best at 2035, arbitrary elsewhere
    const scores: Record<number, number> = { 2027: 500, 2028: 300, 2029: 700, 2030: 100, 2031: 400, 2032: 350 }
    const result = findDownYearPlacements({
      count: 3,
      earliestYear: 2027,
      latestYear: 2034, // last feasible start is 2034 - 3 + 1 = 2032
      scoreStartYear: (y) => scores[y] ?? 1_000,
    })!
    expect(result.worst.startYear).toBe(2030)
    expect(result.worst.endValue).toBe(100)
    expect(result.best.startYear).toBe(2029)
    expect(result.best.endValue).toBe(700)
  })

  it('covers the full inclusive range, including the very last feasible start year', () => {
    const seen: number[] = []
    findDownYearPlacements({
      count: 2,
      earliestYear: 2027,
      latestYear: 2030, // last feasible start is 2030 - 2 + 1 = 2029
      scoreStartYear: (y) => {
        seen.push(y)
        return 0
      },
    })
    expect(seen).toEqual([2027, 2028, 2029])
  })

  it('when exactly one placement fits, worst and best are that same placement', () => {
    const result = findDownYearPlacements({
      count: 5,
      earliestYear: 2027,
      latestYear: 2031, // exactly 5 years, one feasible start: 2027
      scoreStartYear: () => 42,
    })!
    expect(result.worst.startYear).toBe(2027)
    expect(result.best.startYear).toBe(2027)
  })
})

describe('downYearRateOverrides', () => {
  it('sets exactly `count` consecutive years, starting at `startYear`, to `rate`', () => {
    const overrides = downYearRateOverrides(2030, 3, -0.2)
    expect([...overrides.investments!.entries()]).toEqual([
      [2030, -0.2],
      [2031, -0.2],
      [2032, -0.2],
    ])
  })

  it('applies to pension and investments identically', () => {
    const overrides = downYearRateOverrides(2030, 2, -0.15)
    expect([...overrides.pension!.entries()]).toEqual([...overrides.investments!.entries()])
  })

  it('never touches cash — matches the "down-market" framing', () => {
    const overrides = downYearRateOverrides(2030, 2, -0.2)
    expect(overrides.cash).toBeUndefined()
  })

  it('count of 0 produces an empty map, not an error', () => {
    const overrides = downYearRateOverrides(2030, 0, -0.2)
    expect(overrides.investments!.size).toBe(0)
  })
})
