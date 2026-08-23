import { describe, expect, it } from 'vitest'
import { priceBounds, segmentRuns, xForIndex, yForPrice } from './SeriesChart'
import type { SeriesPoint } from '@/lib/tracker/types'

function point(onDate: string, priceMicro: number, isForwardFilled = false): SeriesPoint {
  return {
    onDate,
    unitPriceMicro: priceMicro,
    unitsMicro: 50_000_000_000,
    valuePence: 50_000,
    isOpening: false,
    isForwardFilled,
  }
}

describe('priceBounds', () => {
  it('spans the series with padding, so the line never touches the frame', () => {
    const bounds = priceBounds([point('a', 1_000_000), point('b', 1_100_000)])
    expect(bounds.min).toBeLessThan(1_000_000)
    expect(bounds.max).toBeGreaterThan(1_100_000)
  })

  it('gives a flat series a range rather than dividing by zero', () => {
    const bounds = priceBounds([point('a', 1_000_000), point('b', 1_000_000)])
    expect(bounds.max).toBeGreaterThan(bounds.min)
  })

  it('handles an empty series', () => {
    expect(priceBounds([])).toEqual({ min: 0, max: 1 })
  })
})

describe('coordinates', () => {
  it('spreads points evenly and centres a single one', () => {
    expect(xForIndex(0, 5)).toBeLessThan(xForIndex(4, 5))
    expect(xForIndex(0, 1)).toBe(xForIndex(0, 1))
  })

  it('puts a higher price higher up the chart', () => {
    const bounds = { min: 0, max: 100 }
    expect(yForPrice(90, bounds)).toBeLessThan(yForPrice(10, bounds))
  })

  it('does not divide by zero on a zero-span range', () => {
    expect(Number.isFinite(yForPrice(5, { min: 5, max: 5 }))).toBe(true)
  })
})

describe('segmentRuns', () => {
  // Observed and carried-forward stretches are stroked differently, so they
  // have to be split into runs — a gap must read as a gap.
  it('returns one run when nothing is forward-filled', () => {
    const runs = segmentRuns([point('a', 1), point('b', 2), point('c', 3)])
    expect(runs).toEqual([{ filled: false, from: 0, to: 2 }])
  })

  it('splits where a forward-filled stretch begins and ends', () => {
    const runs = segmentRuns([
      point('a', 1),
      point('b', 2),
      point('c', 2, true),
      point('d', 2, true),
      point('e', 3),
    ])
    expect(runs.map((r) => r.filled)).toEqual([false, true, false])
  })

  it('overlaps runs by one point so the line stays continuous', () => {
    const runs = segmentRuns([point('a', 1), point('b', 1, true), point('c', 2)])
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i]!.from).toBe(runs[i - 1]!.to)
    }
  })

  it('has nothing to draw for a series of fewer than two points', () => {
    expect(segmentRuns([point('a', 1)])).toEqual([])
    expect(segmentRuns([])).toEqual([])
  })
})
