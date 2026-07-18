import { describe, expect, it } from 'vitest'
import { analyseHousehold, householdStopScenario } from './household'
import { SAMPLE_HOUSEHOLD } from '../sampleHousehold'
import type { Household } from './types'

describe('analyseHousehold (spec §3, §4)', () => {
  const a = analyseHousehold(SAMPLE_HOUSEHOLD, { baseYear: 2025 })

  it('computes the household FI number from the target income', () => {
    expect(a.fi).toBe(1_750_000) // £70,000 / 0.04
  })

  it('splits net worth three ways and sums the household', () => {
    expect(a.combined.netWorth.pension).toBe(145_000 + 98_000)
    expect(a.combined.netWorth.stocks).toBe(76_000 + 41_000)
    expect(a.combined.netWorth.cash).toBe(32_000 + 18_000)
    expect(a.combined.netWorth.total).toBe(410_000)
  })

  it('excludes ring-fenced cash from the investable base', () => {
    // Sam's £32k cash is ring-fenced; Alex's £18k is not.
    expect(a.combined.investableToday).toBe(410_000 - 32_000)
  })

  it('uses the longest runway across the household as the horizon', () => {
    // Alex is 34, retires at 58 → 24 years (longer than Sam's 22).
    expect(a.horizon).toBe(24)
  })

  it('gives each person a per-pot coast status', () => {
    const sam = a.people[0]!
    expect(sam.pension.coast.coastNumber).toBeGreaterThan(0)
    expect(typeof sam.pension.coast.coasting).toBe('boolean')
    expect(sam.netWorth.total).toBe(145_000 + 76_000 + 32_000)
  })

  it('projects the combined pot to grow well beyond today', () => {
    expect(a.combined.investableFinal).toBeGreaterThan(a.combined.investableToday)
  })

  it('keeps the deployed + generated + starting = final invariant', () => {
    const { deployed, generated, finalValue } = a.combined.deployed
    expect(deployed + generated + a.combined.investableToday).toBeCloseTo(
      finalValue,
      2,
    )
  })

  it('labels the combined crossover with a calendar year', () => {
    if (a.combined.crossover.year !== null) {
      expect(a.combined.crossover.calendarYear).toBe(
        2025 + a.combined.crossover.year,
      )
    }
  })

  it('handles a single-person household', () => {
    const single: Household = {
      ...SAMPLE_HOUSEHOLD,
      people: [SAMPLE_HOUSEHOLD.people[0]],
    }
    const s = analyseHousehold(single)
    expect(s.people).toHaveLength(1)
    expect(s.combined.netWorth.total).toBe(145_000 + 76_000 + 32_000)
  })
})

describe('householdStopScenario (spec §3.6, §3.10)', () => {
  it('lands below the keep-contributing path and runs a bridge check', () => {
    const keep = analyseHousehold(SAMPLE_HOUSEHOLD).combined.investableFinal
    const stop = householdStopScenario(SAMPLE_HOUSEHOLD, 45)
    expect(stop.finalValue).toBeLessThan(keep)
    expect(stop.stopAge).toBe(45)
    expect(stop.stocksAtStop).toBeGreaterThan(0)
    expect(stop.bridge.bridgeYears).toBe(57 - 45)
    expect(typeof stop.bridge.covered).toBe('boolean')
  })

  it('freezing later leaves a bigger pot than freezing earlier', () => {
    const early = householdStopScenario(SAMPLE_HOUSEHOLD, 40).finalValue
    const late = householdStopScenario(SAMPLE_HOUSEHOLD, 50).finalValue
    expect(late).toBeGreaterThan(early)
  })
})
