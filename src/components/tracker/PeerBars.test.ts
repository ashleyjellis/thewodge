import { describe, expect, it } from 'vitest'
import { barGeometry, zeroLinePct } from './PeerBars'

describe('barGeometry', () => {
  // The bug this exists to prevent: scaling width by absolute value makes a
  // 10% loss a longer bar than a 6% gain, so a reader scanning bar lengths
  // reads the worst performer as the best.
  it('does not let a loss out-draw a smaller gain', () => {
    const loss = barGeometry(-0.1022, -0.1022, 0.3027)
    const gain = barGeometry(0.0637, -0.1022, 0.3027)
    expect(loss.leftPct).toBeLessThan(gain.leftPct)
    // and the loss sits entirely left of where the gain begins
    expect(loss.leftPct + loss.widthPct).toBeLessThanOrEqual(gain.leftPct + 0.01)
  })

  it('starts a gain at the zero line and extends right', () => {
    const zero = zeroLinePct(-0.1, 0.3)
    const gain = barGeometry(0.15, -0.1, 0.3)
    expect(gain.leftPct).toBeCloseTo(zero, 5)
  })

  it('ends a loss at the zero line, extending left', () => {
    const zero = zeroLinePct(-0.1, 0.3)
    const loss = barGeometry(-0.05, -0.1, 0.3)
    expect(loss.leftPct + loss.widthPct).toBeCloseTo(zero, 5)
  })

  it('puts zero on the left edge when everything is positive', () => {
    expect(zeroLinePct(0.02, 0.3)).toBe(0)
    expect(barGeometry(0.02, 0.02, 0.3).leftPct).toBe(0)
  })

  it('puts zero on the right edge when everything is negative', () => {
    expect(zeroLinePct(-0.3, -0.02)).toBe(100)
  })

  it('keeps a near-zero value visible rather than vanishing', () => {
    expect(barGeometry(0.0001, -0.2, 0.2).widthPct).toBeGreaterThan(0)
  })

  it('does not divide by zero when every peer is flat', () => {
    expect(barGeometry(0, 0, 0)).toEqual({ leftPct: 0, widthPct: 0 })
    expect(zeroLinePct(0, 0)).toBe(0)
  })

  it('never draws outside the track', () => {
    for (const value of [-0.3, -0.1, 0, 0.1, 0.3]) {
      const g = barGeometry(value, -0.3, 0.3)
      expect(g.leftPct).toBeGreaterThanOrEqual(0)
      expect(g.leftPct + g.widthPct).toBeLessThanOrEqual(100.01)
    }
  })
})
