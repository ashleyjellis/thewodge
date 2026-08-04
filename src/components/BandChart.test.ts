import { describe, expect, it } from 'vitest'
import {
  bandPath,
  midLinePath,
  valueRange,
  xAxisLabelIndices,
  xForIndex,
  yForValue,
  type BandPoint,
} from './BandChart'

describe('xForIndex', () => {
  it('centres a single point', () => {
    expect(xForIndex(0, 1, 600)).toBe(300)
  })

  it('places the first point at the left edge', () => {
    expect(xForIndex(0, 5, 600)).toBe(0)
  })

  it('places the last point at the right edge', () => {
    expect(xForIndex(4, 5, 600)).toBe(600)
  })

  it('spaces middle points proportionally', () => {
    expect(xForIndex(2, 5, 600)).toBe(300) // exact midpoint of 5 points
  })
})

describe('valueRange', () => {
  it('returns {0, 0} for an empty series', () => {
    expect(valueRange([])).toEqual({ min: 0, max: 0 })
  })

  it('spans every point\'s low/mid/high, not just one series', () => {
    const points: BandPoint[] = [
      { x: '2026', low: 100, mid: 150, high: 200 },
      { x: '2027', low: 50, mid: 300, high: 900 }, // the true min AND max live here
    ]
    expect(valueRange(points)).toEqual({ min: 50, max: 900 })
  })

  it('the global min can come from one point and the max from another', () => {
    const points: BandPoint[] = [
      { x: '2026', low: 10, mid: 20, high: 30 },
      { x: '2027', low: 40, mid: 50, high: 60 },
    ]
    expect(valueRange(points)).toEqual({ min: 10, max: 60 })
  })
})

describe('yForValue', () => {
  it('the max value sits at the top (y = 0)', () => {
    expect(yForValue(100, 0, 100, 200)).toBe(0)
  })

  it('the min value sits at the bottom (y = height)', () => {
    expect(yForValue(0, 0, 100, 200)).toBe(200)
  })

  it('a middle value sits proportionally between them', () => {
    expect(yForValue(50, 0, 100, 200)).toBe(100)
  })

  it('a flat series (min === max) sits on a centred line, never divides by zero', () => {
    expect(yForValue(50, 50, 50, 200)).toBe(100)
    expect(Number.isFinite(yForValue(50, 50, 50, 200))).toBe(true)
  })
})

describe('bandPath', () => {
  it('is empty for no points', () => {
    expect(bandPath([], 0, 100, 600, 200)).toBe('')
  })

  it('starts with M, closes with Z, and uses one L per remaining coordinate', () => {
    const points: BandPoint[] = [
      { x: '2026', low: 0, mid: 50, high: 100 },
      { x: '2027', low: 10, mid: 60, high: 110 },
      { x: '2028', low: 20, mid: 70, high: 120 },
    ]
    const path = bandPath(points, 0, 120, 600, 200)
    expect(path.startsWith('M ')).toBe(true)
    expect(path.endsWith(' Z')).toBe(true)
    // 3 high points + 3 low points = 6 coordinates total = 1 M + 5 L
    expect(path.match(/L /g)).toHaveLength(5)
  })

  it('traces the high line first (top), then the low line in reverse (bottom)', () => {
    const points: BandPoint[] = [
      { x: '2026', low: 0, mid: 50, high: 100 }, // low is the global min, high is the global max
      { x: '2027', low: 10, mid: 60, high: 90 },
    ]
    const path = bandPath(points, 0, 100, 600, 200)
    // first coordinate: point 0's high (the global max) -> y=0 exactly (top)
    expect(path).toMatch(/^M 0,0 /)
    // last coordinate: point 0's low (the global min), revisited at the very
    // end since the bottom edge is traced in reverse -> y=200 exactly (bottom)
    expect(path.endsWith('0,200 Z')).toBe(true)
  })

  it('a single point still produces a (degenerate) closed path', () => {
    const path = bandPath([{ x: '2026', low: 0, mid: 50, high: 100 }], 0, 100, 600, 200)
    expect(path.startsWith('M ')).toBe(true)
    expect(path.endsWith(' Z')).toBe(true)
  })
})

describe('midLinePath', () => {
  it('is empty for no points', () => {
    expect(midLinePath([], 0, 100, 600, 200)).toBe('')
  })

  it('uses each point\'s mid value, not low or high', () => {
    const points: BandPoint[] = [
      { x: '2026', low: 0, mid: 50, high: 100 },
      { x: '2027', low: 10, mid: 60, high: 110 },
    ]
    const path = midLinePath(points, 0, 110, 600, 200)
    // point 0: mid=50 of [0,110] -> y = 200 - (50/110)*200
    const expectedY0 = 200 - (50 / 110) * 200
    expect(path).toContain(`0,${expectedY0}`)
  })

  it('is never closed (no Z) — it\'s a line, not a fill region', () => {
    const points: BandPoint[] = [
      { x: '2026', low: 0, mid: 50, high: 100 },
      { x: '2027', low: 10, mid: 60, high: 110 },
    ]
    expect(midLinePath(points, 0, 110, 600, 200)).not.toContain('Z')
  })
})

describe('xAxisLabelIndices', () => {
  it('returns every index when the series is shorter than the max', () => {
    expect(xAxisLabelIndices(3, 5)).toEqual([0, 1, 2])
  })

  it('always includes the first and last index', () => {
    const indices = xAxisLabelIndices(30, 5)
    expect(indices[0]).toBe(0)
    expect(indices.at(-1)).toBe(29)
  })

  it('never returns more than maxLabels indices', () => {
    expect(xAxisLabelIndices(30, 5).length).toBeLessThanOrEqual(5)
  })

  it('returns an empty array for an empty series', () => {
    expect(xAxisLabelIndices(0, 5)).toEqual([])
  })

  it('never returns duplicate indices even for a short-but-over-max series', () => {
    const indices = xAxisLabelIndices(4, 5)
    expect(new Set(indices).size).toBe(indices.length)
  })
})
