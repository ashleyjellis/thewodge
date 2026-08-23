/**
 * The demo dataset, checked against the engine.
 *
 * The point of these cases is not that rows exist — it is that each one
 * actually produces the UI state it was forced to produce. A "portfolio that
 * has not recovered" which quietly recovered would leave that state untested
 * and unbuilt, and nobody would notice until real money was in.
 */
import { describe, expect, it } from 'vitest'
import { buildDemoDataset, DEMO_PROVIDERS, mulberry32 } from './demoData'
import { buildSeries, netInvestedPence } from './series'
import { analyseDrawdown } from './drawdown'
import { annualisedVolatility } from './volatility'
import { simpleReturn, timeWeightedReturn } from './returns'

const REFERENCE = '2026-08-23'
const dataset = buildDemoDataset(REFERENCE)

function portfolio(providerSlug: string, riskSlug: string) {
  const found = dataset.portfolios.find(
    (p) => p.providerSlug === providerSlug && p.slug === `fully-managed-${riskSlug}`,
  )
  if (!found) throw new Error(`no demo portfolio ${providerSlug}/${riskSlug}`)
  return found
}

function seriesFor(providerSlug: string, riskSlug: string) {
  const p = portfolio(providerSlug, riskSlug)
  return buildSeries({
    inceptionDate: p.inceptionDate,
    initialPence: p.initialPence,
    readings: p.readings,
    flows: p.flows,
  })
}

describe('shape', () => {
  it('has six fictional providers, none of them a real firm', () => {
    expect(DEMO_PROVIDERS).toHaveLength(6)
    expect(DEMO_PROVIDERS.map((p) => p.slug)).toEqual([
      'northgate', 'bramble', 'kestrel', 'aldworth', 'pennine', 'foxglove',
    ])
  })

  it('offers three risk levels per provider — eighteen portfolios', () => {
    expect(dataset.portfolios).toHaveLength(18)
  })

  it('covers both a flat fee structure and a tiered one', () => {
    expect(DEMO_PROVIDERS.some((p) => p.platformFeeBps !== null)).toBe(true)
    expect(DEMO_PROVIDERS.some((p) => p.feeTiers !== null)).toBe(true)
  })

  it('is reproducible from its fixed seed', () => {
    const again = buildDemoDataset(REFERENCE)
    expect(again.portfolios[0]!.readings).toEqual(dataset.portfolios[0]!.readings)
    expect(again.portfolios[17]!.readings).toEqual(dataset.portfolios[17]!.readings)
  })

  it('has a PRNG that is deterministic and stays in range', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 100; i++) {
      const value = a()
      expect(value).toBe(b())
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('the hand-forced cases each produce their state', () => {
  it('a deep fall that fully recovers', () => {
    // Asserted to the exact depth, not merely "deep". A loose bound here
    // originally let a 22% drawdown pass as the intended 12% one, because the
    // walk had drifted down from an earlier peak before the forced fall began
    // and the two stacked.
    const analysis = analyseDrawdown(seriesFor('northgate', 'balanced'))
    expect(analysis.maxDrawdown).toBeCloseTo(-0.12, 3)
    expect(analysis.hasRecovered).toBe(true)
    expect(analysis.recoveryDate).not.toBeNull()
    expect(analysis.recoveryWeeks).toBeGreaterThan(0)
  })

  it('a fall that has NOT recovered — the null state', () => {
    const analysis = analyseDrawdown(seriesFor('bramble', 'adventurous'))
    expect(analysis.maxDrawdown).toBeCloseTo(-0.15, 2)
    expect(analysis.hasRecovered).toBe(false)
    expect(analysis.recoveryDate).toBeNull()
    expect(analysis.recoveryWeeks).toBeNull()
    expect(analysis.weeksSinceTrough).toBeGreaterThan(0)
  })

  it('a twelve-week-old portfolio: statistics suppressed', () => {
    const p = portfolio('kestrel', 'cautious')
    expect(p.readings).toHaveLength(12)
    const vol = annualisedVolatility(seriesFor('kestrel', 'cautious'))
    expect(vol.isDisplayable).toBe(false)
    expect(vol.annualised).toBeNull()
  })

  it('a three-reading portfolio: the thin state', () => {
    const p = portfolio('aldworth', 'cautious')
    expect(p.readings).toHaveLength(3)
    expect(annualisedVolatility(seriesFor('aldworth', 'cautious')).annualised).toBeNull()
  })

  it('two missing weeks mid-series, forward-filled and flagged', () => {
    const p = portfolio('pennine', 'balanced')
    expect(p.readings).toHaveLength(50) // 52 weeks less the two skipped
    const filled = seriesFor('pennine', 'balanced').filter((point) => point.isForwardFilled)
    expect(filled.length).toBeGreaterThanOrEqual(2)
  })

  it('weekly contributions pull the two return measures apart', () => {
    const p = portfolio('foxglove', 'balanced')
    const points = seriesFor('foxglove', 'balanced')
    const input = {
      inceptionDate: p.inceptionDate,
      initialPence: p.initialPence,
      readings: p.readings,
      flows: p.flows,
    }
    const twr = timeWeightedReturn(points)!
    const simple = simpleReturn(points[points.length - 1]!.valuePence, netInvestedPence(input))!
    expect(twr).not.toBeCloseTo(simple, 3)
    expect(netInvestedPence(input)).toBe(50_000 + 52 * 2_500)
  })

  it('a standard series is long enough to be provisional, not yet unqualified', () => {
    const vol = annualisedVolatility(seriesFor('northgate', 'cautious'))
    expect(vol.readingCount).toBe(52)
    expect(vol.isDisplayable).toBe(true)
    expect(vol.isProvisional).toBe(true)
    expect(vol.annualised).toBeGreaterThan(0)
  })
})

describe('readings are consistent with flows', () => {
  // If a generated value ignored a contribution, the derived unit price would
  // lurch the day money went in, inventing a movement that never happened.
  it('never produces a price jump on a contribution date', () => {
    const p = portfolio('foxglove', 'balanced')
    const points = seriesFor('foxglove', 'balanced')
    const contributionDates = new Set(
      p.flows.filter((f) => f.kind === 'contribution').map((f) => f.effectiveDate),
    )
    const moves: number[] = []
    for (let i = 1; i < points.length; i++) {
      if (contributionDates.has(points[i]!.onDate)) {
        moves.push(Math.abs(points[i]!.unitPriceMicro / points[i - 1]!.unitPriceMicro - 1))
      }
    }
    expect(moves.length).toBeGreaterThan(40)
    // a normal weekly market move, not a step change from mispriced units
    expect(Math.max(...moves)).toBeLessThan(0.1)
  })

  it('every portfolio opens at a unit price of exactly 1.000000', () => {
    for (const p of dataset.portfolios) {
      const points = buildSeries({
        inceptionDate: p.inceptionDate,
        initialPence: p.initialPence,
        readings: p.readings,
        flows: p.flows,
      })
      expect(points[0]!.unitPriceMicro).toBe(1_000_000)
    }
  })

  it('every reading value is a whole number of pence', () => {
    for (const p of dataset.portfolios) {
      for (const reading of p.readings) {
        expect(Number.isInteger(reading.valuePence)).toBe(true)
      }
    }
  })
})

describe('supporting data', () => {
  it('has monthly composition for three portfolios, summing to 100%', () => {
    expect(dataset.holdings.length).toBe(3 * 3 * 5)
    const firstMonth = dataset.holdings.filter(
      (h) => h.asOfDate === dataset.holdings[0]!.asOfDate &&
             h.portfolioSlug === dataset.holdings[0]!.portfolioSlug &&
             h.providerSlug === dataset.holdings[0]!.providerSlug,
    )
    expect(firstMonth.reduce((sum, h) => sum + h.weightBps, 0)).toBe(10_000)
  })

  it('includes a cash weighting, so cash drag is visible', () => {
    expect(dataset.holdings.some((h) => h.assetClass === 'cash')).toBe(true)
  })

  it('has global equity and global bond benchmarks', () => {
    expect(dataset.benchmarks.map((b) => b.code)).toEqual(['GLOBAL_EQUITY', 'GLOBAL_BOND'])
    for (const benchmark of dataset.benchmarks) {
      expect(benchmark.readings).toHaveLength(53)
    }
  })

  it('has three notes and twenty subscribers in mixed confirmation states', () => {
    expect(dataset.notes).toHaveLength(3)
    expect(dataset.subscribers).toHaveLength(20)
    expect(dataset.subscribers.some((s) => s.confirmedAt === null)).toBe(true)
    expect(dataset.subscribers.some((s) => s.confirmedAt !== null)).toBe(true)
  })
})
