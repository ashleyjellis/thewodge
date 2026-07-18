import { describe, expect, it } from 'vitest'
import {
  benchmarkBandForAge,
  benchmarkMultiple,
  medianForAge,
  PENSION_BENCHMARKS,
} from './benchmarks'

describe('benchmarks (spec §3, §4)', () => {
  it('picks the right age band', () => {
    expect(benchmarkBandForAge(36).label).toBe('35–44')
    expect(benchmarkBandForAge(25).label).toBe('25–34')
    expect(benchmarkBandForAge(64).label).toBe('55–64')
  })

  it('clamps ages outside the table', () => {
    expect(benchmarkBandForAge(10).label).toBe('16–24')
    expect(benchmarkBandForAge(90).label).toBe('65+')
  })

  it('has monotonically rising medians through working life', () => {
    const working = PENSION_BENCHMARKS.slice(0, 5).map((b) => b.median)
    for (let i = 1; i < working.length; i++) {
      expect(working[i]!).toBeGreaterThan(working[i - 1]!)
    }
  })

  it('computes the multiple of the median', () => {
    // £221,000 at 36 vs a £40,000 median ≈ 5.525×
    const r = benchmarkMultiple(221_000, 36)
    expect(r.median).toBe(40_000)
    expect(r.multiple).toBeCloseTo(5.525, 3)
  })

  it('exposes a median lookup', () => {
    expect(medianForAge(50)).toBe(95_000)
  })
})
