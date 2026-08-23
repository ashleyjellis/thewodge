/**
 * The P1 sections' arithmetic.
 *
 * Two things are being protected here beyond correctness. Every block has to
 * render an explicit thin state rather than a plausible-looking placeholder,
 * so the absent cases are tested as carefully as the present ones. And the
 * cost projection has to stay arithmetic on a published rate card — anything
 * that starts behaving like a forecast has drifted somewhere it should not.
 */
import { describe, expect, it } from 'vitest'
import {
  analyseLossFrequency,
  MIN_WEEKS_FOR_FREQUENCY,
  SHARP_FALL_THRESHOLD,
} from './lossFrequency'
import {
  annualCostPence,
  buildBandCost,
  feeBpsFor,
  projectedCostPence,
  PROJECTION_YEARS,
} from './costBand'
import {
  buildSnapshot,
  describeDiff,
  diffSnapshots,
  isChangelogWorthy,
  snapshotsByDate,
  type Holding,
} from './holdings'
import { addDays } from './dates'
import { MICRO } from './money'
import type { SeriesPoint } from './types'

const START = '2025-01-06'

/** A series from a list of weekly moves, as fractions. */
function seriesFromMoves(moves: number[], forwardFilledAt: number[] = []): SeriesPoint[] {
  const points: SeriesPoint[] = [
    {
      onDate: START,
      unitPriceMicro: MICRO,
      unitsMicro: 50_000 * MICRO,
      valuePence: 50_000,
      isOpening: true,
      isForwardFilled: false,
    },
  ]
  let price = MICRO
  moves.forEach((move, index) => {
    price = Math.round(price * (1 + move))
    points.push({
      onDate: addDays(START, (index + 1) * 7),
      unitPriceMicro: price,
      unitsMicro: 50_000 * MICRO,
      valuePence: Math.round(50_000 * (price / MICRO)),
      isOpening: false,
      isForwardFilled: forwardFilledAt.includes(index + 1),
    })
  })
  return points
}

describe('P1.4 — frequency of loss', () => {
  it('counts weeks up and down', () => {
    const result = analyseLossFrequency(seriesFromMoves([0.01, -0.01, 0.02, -0.02, 0.01, -0.01, 0.01, -0.01, 0.01, -0.01, 0.01, -0.01]))
    expect(result.isSufficient).toBe(true)
    expect(result.weeksUp).toBe(6)
    expect(result.weeksDown).toBe(6)
    expect(result.observedWeeks).toBe(12)
  })

  it('finds the longest unbroken run of down weeks', () => {
    const result = analyseLossFrequency(
      seriesFromMoves([0.01, -0.01, -0.01, -0.01, 0.01, -0.01, -0.01, 0.01, 0.01, 0.01, -0.01, 0.01]),
    )
    expect(result.longestDownRun).toBe(3)
  })

  it('counts only falls beyond the sharp threshold', () => {
    const justUnder = -SHARP_FALL_THRESHOLD + 0.001
    const justOver = -SHARP_FALL_THRESHOLD - 0.001
    const result = analyseLossFrequency(
      seriesFromMoves([justOver, justUnder, justOver, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]),
    )
    expect(result.sharpFalls).toBe(2)
    expect(result.sharpFallShare).toBeCloseTo(2 / 12, 6)
  })

  it('publishes nothing at all below the sufficiency gate', () => {
    // Not zero, not "0 down weeks" — absent. Three weeks of data producing
    // "67% of weeks were down" is arithmetic, not evidence.
    const result = analyseLossFrequency(seriesFromMoves([-0.01, -0.01, 0.01]))
    expect(result.isSufficient).toBe(false)
    expect(result.weeksUp).toBeNull()
    expect(result.weeksDown).toBeNull()
    expect(result.longestDownRun).toBeNull()
    expect(result.sharpFallShare).toBeNull()
    expect(result.observedWeeks).toBe(3)
  })

  it('crosses the gate at exactly the stated number of weeks', () => {
    const moves = Array.from({ length: MIN_WEEKS_FOR_FREQUENCY }, () => 0.01)
    expect(analyseLossFrequency(seriesFromMoves(moves)).isSufficient).toBe(true)
    expect(analyseLossFrequency(seriesFromMoves(moves.slice(1))).isSufficient).toBe(false)
  })

  it('does not count a week nobody took a reading in', () => {
    // A carried-forward price did not observably do anything. Counting it as
    // a flat week would claim a stability that was never seen.
    const moves = Array.from({ length: 14 }, () => 0.01)
    const withGaps = analyseLossFrequency(seriesFromMoves(moves, [3, 7]))
    expect(withGaps.observedWeeks).toBe(12)
    expect(withGaps.weeksUp).toBe(12)
  })

  it('counts an exactly unchanged week as neither up nor down', () => {
    const moves = [0, ...Array.from({ length: 12 }, () => 0.01)]
    const result = analyseLossFrequency(seriesFromMoves(moves))
    expect(result.weeksFlat).toBe(1)
    expect(result.weeksUp! + result.weeksDown! + result.weeksFlat!).toBe(result.observedWeeks)
  })
})

describe('P1.5 — cost against the band', () => {
  const flat = { platformFeeBps: 75, feeTiersJson: null }
  const tiered = {
    platformFeeBps: 45,
    feeTiersJson: JSON.stringify([
      { upto_pence: 1_000_000, bps: 90 },
      { upto_pence: null, bps: 20 },
    ]),
  }

  it('charges the annual fee on the modelled balance', () => {
    expect(annualCostPence(75, 2_000_000)).toBe(15_000) // £150 on £20,000
  })

  it('resolves a tiered card at the balance the reader chose', () => {
    expect(feeBpsFor(tiered, 500_000)).toBe(90)
    expect(feeBpsFor(tiered, 5_000_000)).toBe(20)
    expect(feeBpsFor(flat, 5_000_000)).toBe(75)
  })

  it('projects roughly ten years of the annual charge, slightly less for compounding', () => {
    const annual = annualCostPence(75, 2_000_000)
    const projected = projectedCostPence(75, 2_000_000)
    // Each year is charged on a shrinking balance, so the total is below ten
    // times the first year but comfortably above nine.
    expect(projected).toBeLessThan(annual * PROJECTION_YEARS)
    expect(projected).toBeGreaterThan(annual * (PROJECTION_YEARS - 1.5))
  })

  it('projects nothing when nothing is charged', () => {
    expect(projectedCostPence(0, 2_000_000)).toBe(0)
    expect(projectedCostPence(75, 0)).toBe(0)
  })

  it('includes this portfolio in its own band average', () => {
    // Excluding it would make the average shift as the reader moved between
    // pages describing the same set of portfolios.
    const cost = buildBandCost(flat, [{ platformFeeBps: 25, feeTiersJson: null }], 2_000_000)
    expect(cost.bandAverageBps).toBe(50)
    expect(cost.peerCount).toBe(1)
  })

  it('reports the spread across the band at one balance', () => {
    const cost = buildBandCost(
      flat,
      [
        { platformFeeBps: 25, feeTiersJson: null },
        { platformFeeBps: 120, feeTiersJson: null },
      ],
      2_000_000,
    )
    expect(cost.bandLowestBps).toBe(25)
    expect(cost.bandHighestBps).toBe(120)
    expect(cost.feeBps).toBe(75)
  })

  it('says how far from the average this one sits, in pounds', () => {
    const cost = buildBandCost(flat, [{ platformFeeBps: 25, feeTiersJson: null }], 2_000_000)
    // 75bps vs a 50bps average on £20,000 is £50 a year more.
    expect(cost.differenceFromAveragePence).toBe(5_000)
  })

  it('renders a thin state rather than a band of one', () => {
    const cost = buildBandCost(flat, [], 2_000_000)
    expect(cost.peerCount).toBe(0)
    expect(cost.bandAverageBps).toBeNull()
    expect(cost.bandLowestBps).toBeNull()
    expect(cost.differenceFromAveragePence).toBeNull()
    // Its own cost is still known and still shown.
    expect(cost.annualPence).toBe(15_000)
  })

  it('compares peers at the reader’s balance, not at their headline rate', () => {
    // The tiered provider is dearer at £5,000 and far cheaper at £50,000.
    // Comparing headline rates would get this backwards.
    const atSmall = buildBandCost(flat, [tiered], 500_000)
    const atLarge = buildBandCost(flat, [tiered], 5_000_000)
    expect(atSmall.bandHighestBps).toBe(90)
    expect(atLarge.bandLowestBps).toBe(20)
  })
})

describe('P1.2 — holdings and the monthly diff', () => {
  function holding(over: Partial<Holding>): Holding {
    return {
      asOfDate: '2026-08-23',
      instrumentName: 'Global Equity Index Fund',
      assetClass: 'equity',
      region: 'Global',
      weightBps: 4800,
      isin: null,
      ...over,
    }
  }

  const june: Holding[] = [
    holding({ asOfDate: '2026-06-24', instrumentName: 'Global Equity', assetClass: 'equity', region: 'Global', weightBps: 5000 }),
    holding({ asOfDate: '2026-06-24', instrumentName: 'US Equity', assetClass: 'equity', region: 'US', weightBps: 2200 }),
    holding({ asOfDate: '2026-06-24', instrumentName: 'Gilt Fund', assetClass: 'bond', region: 'UK', weightBps: 2540 }),
    holding({ asOfDate: '2026-06-24', instrumentName: 'Cash', assetClass: 'cash', region: null, weightBps: 260 }),
  ]
  const july: Holding[] = [
    holding({ asOfDate: '2026-07-24', instrumentName: 'Global Equity', assetClass: 'equity', region: 'Global', weightBps: 5000 }),
    holding({ asOfDate: '2026-07-24', instrumentName: 'US Equity', assetClass: 'equity', region: 'US', weightBps: 1880 }),
    holding({ asOfDate: '2026-07-24', instrumentName: 'Gilt Fund', assetClass: 'bond', region: 'UK', weightBps: 2710 }),
    holding({ asOfDate: '2026-07-24', instrumentName: 'Cash', assetClass: 'cash', region: null, weightBps: 410 }),
  ]

  it('groups a snapshot by asset class and region', () => {
    const snapshot = buildSnapshot('2026-06-24', june)
    expect(snapshot.byAssetClass.map((s) => s.key)).toEqual(['equity', 'bond', 'cash'])
    expect(snapshot.byAssetClass[0]!.weightBps).toBe(7200)
    expect(snapshot.totalWeightBps).toBe(10_000)
  })

  it('groups a missing region as "Not stated" rather than dropping it', () => {
    // Dropping it would make the weights quietly fail to add up, with nothing
    // on the page to say why.
    const snapshot = buildSnapshot('2026-06-24', june)
    expect(snapshot.byRegion.map((s) => s.key)).toContain('Not stated')
    expect(snapshot.byRegion.reduce((sum, s) => sum + s.weightBps, 0)).toBe(10_000)
  })

  it('orders snapshots newest first', () => {
    const all = snapshotsByDate([...june, ...july])
    expect(all.map((s) => s.asOfDate)).toEqual(['2026-07-24', '2026-06-24'])
  })

  it('describes the diff as the brief’s own sentences', () => {
    const diff = diffSnapshots(buildSnapshot('2026-06-24', june), buildSnapshot('2026-07-24', july))
    const lines = describeDiff(diff)
    expect(lines).toContain('Cash 2.6% → 4.1%.')
    expect(lines.some((line) => line.startsWith('US down 3.2 points'))).toBe(true)
  })

  it('lifts the first letter without title-casing an initialism', () => {
    const diff = diffSnapshots(buildSnapshot('2026-06-24', june), buildSnapshot('2026-07-24', july))
    const lines = describeDiff(diff)
    // "UK", not "Uk" — the region keys are already written as they read.
    expect(lines.some((line) => line.startsWith('UK '))).toBe(true)
    expect(lines.some((line) => line.startsWith('Uk '))).toBe(false)
  })

  it('reports holdings added and removed', () => {
    const august = [
      ...july.map((h) => ({ ...h, asOfDate: '2026-08-23' })).slice(0, 3),
      holding({ instrumentName: 'Infrastructure Fund', assetClass: 'alternative', region: 'Global', weightBps: 410 }),
    ]
    const diff = diffSnapshots(
      buildSnapshot('2026-07-24', july),
      buildSnapshot('2026-08-23', august),
    )
    expect(diff.added.map((h) => h.instrumentName)).toEqual(['Infrastructure Fund'])
    expect(diff.removed.map((h) => h.instrumentName)).toEqual(['Cash'])
    expect(describeDiff(diff).some((l) => l === '1 holding added, 1 removed.')).toBe(true)
  })

  it('ignores drift below the material threshold', () => {
    // A 10bp move is as likely to be the market moving weights as the manager
    // moving money; calling it a change would read intent into noise.
    const nudged = june.map((h) =>
      h.instrumentName === 'Cash' ? { ...h, asOfDate: '2026-07-24', weightBps: h.weightBps + 10 } : { ...h, asOfDate: '2026-07-24' },
    )
    const diff = diffSnapshots(
      buildSnapshot('2026-06-24', june),
      buildSnapshot('2026-07-24', nudged),
    )
    expect(diff.assetClassChanges).toEqual([])
    expect(diff.isQuiet).toBe(true)
    expect(describeDiff(diff)).toEqual([])
  })

  it('only writes a changelog entry for a move worth reading', () => {
    const small = diffSnapshots(
      buildSnapshot('2026-06-24', june),
      buildSnapshot(
        '2026-07-24',
        june.map((h) =>
          h.instrumentName === 'Cash'
            ? { ...h, asOfDate: '2026-07-24', weightBps: h.weightBps + 40 }
            : { ...h, asOfDate: '2026-07-24' },
        ),
      ),
    )
    // Reported on the page, but not loud enough for the feed.
    expect(small.assetClassChanges.length).toBeGreaterThan(0)
    expect(isChangelogWorthy(small)).toBe(false)

    const big = diffSnapshots(buildSnapshot('2026-06-24', june), buildSnapshot('2026-07-24', july))
    expect(isChangelogWorthy(big)).toBe(true)
  })

  it('treats a holding changing hands as always worth a changelog entry', () => {
    const swapped = june
      .filter((h) => h.instrumentName !== 'Cash')
      .map((h) => ({ ...h, asOfDate: '2026-07-24' }))
    const diff = diffSnapshots(
      buildSnapshot('2026-06-24', june),
      buildSnapshot('2026-07-24', swapped),
    )
    expect(isChangelogWorthy(diff)).toBe(true)
  })

  it('has nothing to diff from a single snapshot', () => {
    // The page must render allocation only and say the comparison arrives
    // next month, rather than inventing a previous month to compare against.
    expect(snapshotsByDate(june)).toHaveLength(1)
  })
})
