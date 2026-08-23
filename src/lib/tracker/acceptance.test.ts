/**
 * The build brief's acceptance tests, as close to verbatim as they can be
 * written. The brief states the build is not done until these pass, so they
 * are kept together and labelled by their number in it rather than scattered
 * among the unit tests.
 *
 * Tests 8 (CSV round-trip) and 9 (DEMO_MODE banner) involve the export and
 * the pages, and land with those.
 */
import { describe, expect, it } from 'vitest'
import { buildSeries, netInvestedPence } from './series'
import { logReturns, returnsAreEquivalent, simpleReturn, timeWeightedReturn } from './returns'
import { applyFees, tierBpsFor, type FeeTier } from './fees'
import { analyseDrawdown } from './drawdown'
import { annualisedVolatility } from './volatility'
import { MICRO } from './money'
import { addDays } from './dates'
import type { Flow, Reading } from './types'

const INCEPTION = '2026-01-01'
const FIVE_HUNDRED = 50_000 // pence

/** Weekly reading dates starting a week after inception. */
function weekly(count: number, from = INCEPTION): string[] {
  return Array.from({ length: count }, (_, i) => addDays(from, (i + 1) * 7))
}

describe('1. single investment, no flows: TWR equals simple return', () => {
  const values = [50_400, 50_950, 50_100, 51_300, 51_800, 51_200, 52_450, 52_900, 52_100, 53_400]
  const readings: Reading[] = weekly(10).map((valuationDate, i) => ({
    valuationDate,
    valuePence: values[i]!,
  }))

  const input = { inceptionDate: INCEPTION, initialPence: FIVE_HUNDRED, readings, flows: [] }
  const points = buildSeries(input)

  it('produces the two measures as the same number to 4 decimal places', () => {
    const twr = timeWeightedReturn(points)!
    const simple = simpleReturn(
      points[points.length - 1]!.valuePence,
      netInvestedPence(input),
    )!
    expect(twr).toBeCloseTo(simple, 4)
  })

  it('reports them as equivalent, so the page can say so rather than print both', () => {
    expect(returnsAreEquivalent(points)).toBe(true)
  })

  it('opens at a unit price of exactly 1.000000', () => {
    expect(points[0]!.unitPriceMicro).toBe(MICRO)
  })
})

describe('2. a contribution adds units without moving the unit price', () => {
  // The brief's "day 30" contribution. It falls between weekly readings, so
  // the series point for that date carries the price forward from the
  // reading before it — which is exactly the property under test: paying
  // money in cannot itself move the price.
  const contributionDate = addDays(INCEPTION, 30)
  const readings: Reading[] = weekly(8).map((valuationDate, i) => ({
    valuationDate,
    valuePence: FIVE_HUNDRED + (i + 1) * 300,
  }))
  const flows: Flow[] = [
    { effectiveDate: contributionDate, amountPence: 2_500, kind: 'contribution' },
  ]

  const input = { inceptionDate: INCEPTION, initialPence: FIVE_HUNDRED, readings, flows }
  const points = buildSeries(input)
  const atFlow = points.findIndex((p) => p.onDate === contributionDate)

  it('leaves the unit price unchanged across the contribution', () => {
    expect(atFlow).toBeGreaterThan(0)
    expect(points[atFlow]!.unitPriceMicro).toBe(points[atFlow - 1]!.unitPriceMicro)
  })

  it('increases the unit count', () => {
    expect(points[atFlow]!.unitsMicro).toBeGreaterThan(points[atFlow - 1]!.unitsMicro)
  })

  it('increases the value by the amount paid in', () => {
    const before = points[atFlow - 1]!.valuePence
    const after = points[atFlow]!.valuePence
    expect(after - before).toBeCloseTo(2_500, -1)
  })

  it('makes TWR and simple return differ', () => {
    const twr = timeWeightedReturn(points)!
    const simple = simpleReturn(points[points.length - 1]!.valuePence, netInvestedPence(input))!
    expect(twr).not.toBeCloseTo(simple, 4)
    expect(returnsAreEquivalent(points)).toBe(false)
  })
})

describe('2b. a flow landing on a reading date buys at the PREVIOUS price', () => {
  // The brief says units_added uses "unit_price(last known date strictly
  // before d)". When a flow and a reading share a date, that ordering is the
  // whole ballgame: applying the flow after the reading would price the new
  // money at the same day's post-movement value, crediting it with a gain it
  // was never exposed to and silently inflating the unit price.
  //
  // Constructed so the two orderings give visibly different answers rather
  // than differing in the last decimal: the price has already risen to 1.1
  // when £55 goes in, and the closing value is exactly what leaves the price
  // unchanged if — and only if — the flow was priced at 1.1.
  const week1 = addDays(INCEPTION, 7)
  const week2 = addDays(INCEPTION, 14)

  const points = buildSeries({
    inceptionDate: INCEPTION,
    initialPence: FIVE_HUNDRED,
    readings: [
      { valuationDate: week1, valuePence: 55_000 }, // price 1.100000
      { valuationDate: week2, valuePence: 60_500 },
    ],
    flows: [{ effectiveDate: week2, amountPence: 5_500, kind: 'contribution' }],
  })

  const atWeek2 = points.find((p) => p.onDate === week2)!

  it('prices the contribution at the earlier price, leaving the unit price flat', () => {
    // £55 at 1.1 buys 50 units -> 550 total units -> 60500/550 = 1.100000.
    // Pricing it at 1.21 instead would leave the unit price at 1.21.
    expect(atWeek2.unitPriceMicro).toBe(1_100_000)
  })

  it('adds exactly the units the earlier price pays for', () => {
    expect(atWeek2.unitsMicro).toBe(55_000 * MICRO)
  })

  it('does not credit the new money with that day’s movement', () => {
    const twr = timeWeightedReturn(points)!
    expect(twr).toBeCloseTo(0.1, 6) // the 10% rise to week 1, and nothing more
  })
})

describe('3. a 0.75%/yr fee costs 0.75% over a flat year', () => {
  const readings: Reading[] = weekly(52).map((valuationDate) => ({
    valuationDate,
    valuePence: FIVE_HUNDRED, // price pinned at exactly 1.000000 all year
  }))
  readings.push({ valuationDate: addDays(INCEPTION, 365), valuePence: FIVE_HUNDRED })

  const gross = buildSeries({
    inceptionDate: INCEPTION,
    initialPence: FIVE_HUNDRED,
    readings,
    flows: [],
  })
  const net = applyFees({
    points: gross,
    modelledBalancePence: FIVE_HUNDRED,
    tiers: [],
    flatBps: 75,
  })

  it('leaves net value 0.75% below gross, within 0.01%', () => {
    const lastGross = gross[gross.length - 1]!
    const lastNet = net[net.length - 1]!
    const shortfall = (lastGross.valuePence - lastNet.valuePence) / lastGross.valuePence
    expect(shortfall * 100).toBeCloseTo(0.75, 2)
  })

  it('does not take units away — a fee reduces what a unit is worth', () => {
    expect(net[net.length - 1]!.unitsMicro).toBe(gross[gross.length - 1]!.unitsMicro)
  })
})

describe('4. tier selection at a boundary', () => {
  const tiers: FeeTier[] = [
    { upto_pence: 1_000_000, bps: 75 }, // up to £10,000
    { upto_pence: null, bps: 35 },
  ]

  it('applies the lower tier exactly on the boundary', () => {
    expect(tierBpsFor(1_000_000, tiers)).toBe(75)
  })

  it('applies the upper tier one penny above it', () => {
    expect(tierBpsFor(1_000_001, tiers)).toBe(35)
  })

  it('uses the tier a customer with the modelled balance would actually pay', () => {
    expect(tierBpsFor(50_000, tiers)).toBe(75)
    expect(tierBpsFor(5_000_000, tiers)).toBe(35)
  })
})

describe('5. a 12% fall and its recovery', () => {
  // price: 1.00, 0.98, 0.88 (trough), 0.92, 1.00 (recovered)
  const dates = weekly(5)
  const readings: Reading[] = [
    { valuationDate: dates[0]!, valuePence: 50_000 },
    { valuationDate: dates[1]!, valuePence: 49_000 },
    { valuationDate: dates[2]!, valuePence: 44_000 },
    { valuationDate: dates[3]!, valuePence: 46_000 },
    { valuationDate: dates[4]!, valuePence: 50_000 },
  ]
  const points = buildSeries({
    inceptionDate: INCEPTION,
    initialPence: FIVE_HUNDRED,
    readings,
    flows: [],
  })
  const analysis = analyseDrawdown(points)

  it('measures the fall at exactly 12%', () => {
    expect(analysis.maxDrawdown).toBeCloseTo(-0.12, 6)
  })

  it('returns the exact trough date', () => {
    expect(analysis.troughDate).toBe(dates[2])
  })

  it('returns the recovery date and its duration in weeks', () => {
    expect(analysis.recoveryDate).toBe(dates[4])
    expect(analysis.recoveryWeeks).toBe(2)
    expect(analysis.hasRecovered).toBe(true)
  })

  it('reports an unrecovered fall as null rather than as zero', () => {
    const stillDown = buildSeries({
      inceptionDate: INCEPTION,
      initialPence: FIVE_HUNDRED,
      readings: readings.slice(0, 4),
      flows: [],
    })
    const open = analyseDrawdown(stillDown)
    expect(open.hasRecovered).toBe(false)
    expect(open.recoveryDate).toBeNull()
    expect(open.recoveryWeeks).toBeNull()
    expect(open.weeksSinceTrough).toBe(1)
  })
})

describe('6. a missing week is forward-filled, flagged, and returns zero', () => {
  const dates = weekly(6)
  // the reading for week 3 never happened
  const readings: Reading[] = [0, 1, 3, 4, 5].map((i) => ({
    valuationDate: dates[i]!,
    valuePence: 50_000 + i * 500,
  }))
  const points = buildSeries({
    inceptionDate: INCEPTION,
    initialPence: FIVE_HUNDRED,
    readings,
    flows: [],
  })
  const missingDate = dates[2]!
  const index = points.findIndex((p) => p.onDate === missingDate)

  it('still produces a point for the missing week', () => {
    expect(index).toBeGreaterThan(0)
  })

  it('flags it as forward-filled', () => {
    expect(points[index]!.isForwardFilled).toBe(true)
  })

  it('carries the previous price rather than inventing one', () => {
    expect(points[index]!.unitPriceMicro).toBe(points[index - 1]!.unitPriceMicro)
  })

  it('produces exactly zero return for that week', () => {
    const returns = logReturns(points.slice(index - 1, index + 1))
    expect(returns).toHaveLength(1)
    expect(returns[0]).toBe(0)
  })

  it('never interpolates — the real readings keep their own values', () => {
    for (const reading of readings) {
      const point = points.find((p) => p.onDate === reading.valuationDate)!
      expect(point.valuePence).toBe(reading.valuePence)
      expect(point.isForwardFilled).toBe(false)
    }
  })
})

describe('7. twenty readings is not enough to publish a volatility', () => {
  const readings: Reading[] = weekly(20).map((valuationDate, i) => ({
    valuationDate,
    valuePence: 50_000 + ((i * 137) % 900),
  }))
  const points = buildSeries({
    inceptionDate: INCEPTION,
    initialPence: FIVE_HUNDRED,
    readings,
    flows: [],
  })
  const vol = annualisedVolatility(points)

  it('is absent entirely, not zero', () => {
    expect(vol.annualised).toBeNull()
    expect(vol.annualised).not.toBe(0)
  })

  it('is marked undisplayable so the UI cannot render a confident number', () => {
    expect(vol.isDisplayable).toBe(false)
    expect(vol.sufficiency).toBe('insufficient')
  })

  it('becomes provisional once there are 26 readings', () => {
    const more: Reading[] = weekly(26).map((valuationDate, i) => ({
      valuationDate,
      valuePence: 50_000 + ((i * 137) % 900),
    }))
    const enough = annualisedVolatility(
      buildSeries({ inceptionDate: INCEPTION, initialPence: FIVE_HUNDRED, readings: more, flows: [] }),
    )
    expect(enough.isDisplayable).toBe(true)
    expect(enough.isProvisional).toBe(true)
    expect(enough.annualised).toBeGreaterThan(0)
  })
})
