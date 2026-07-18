import { describe, expect, it } from 'vitest'
import {
  deployedVsGenerated,
  futureValueOfAmount,
  lifetimeValueByYear,
} from './lifetimeValue'

describe('futureValueOfAmount (spec §3.7)', () => {
  it('grows a one-off amount by compounding', () => {
    // "£10 today is worth £18 at 40" — ~9 years at 7%.
    expect(futureValueOfAmount(10, 0.07, 9)).toBeCloseTo(18.38, 2)
  })

  it('is unchanged over zero years', () => {
    expect(futureValueOfAmount(10, 0.07, 0)).toBe(10)
  })
})

describe('lifetimeValueByYear', () => {
  const points = lifetimeValueByYear(10, 0.07, 31, 40)

  it('is worth most when saved earliest', () => {
    expect(points[0]).toMatchObject({ age: 31, yearsToHorizon: 9 })
    expect(points[0]!.valueAtHorizon).toBeCloseTo(18.38, 2)
    expect(points[0]!.multiple).toBeCloseTo(1.838, 3)
  })

  it('is worth exactly itself at the horizon', () => {
    const last = points[points.length - 1]!
    expect(last).toMatchObject({ age: 40, yearsToHorizon: 0 })
    expect(last.valueAtHorizon).toBe(10)
    expect(last.multiple).toBe(1)
  })
})

describe('deployedVsGenerated (spec §3.8)', () => {
  it('splits a final pot into what you put in vs what the market added', () => {
    // from the projection hand-case: final 1441, starting 1000, deployed 200.
    const d = deployedVsGenerated(1_441, 200, 1_000)
    expect(d.deployed).toBe(200)
    expect(d.generated).toBeCloseTo(241, 6)
    expect(d.multiple).toBeCloseTo(241 / 200, 6)
  })

  it('treats the whole final value as generated when nothing was deployed', () => {
    const d = deployedVsGenerated(200_000, 0, 100_000)
    expect(d.generated).toBe(100_000)
    expect(d.multiple).toBe(0)
  })
})
