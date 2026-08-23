/**
 * The index's summary, search and sort.
 *
 * The assertions that matter here are the ones about absence: that a thin
 * portfolio reports no return rather than a small one, and that no sort order
 * ever puts it among the portfolios that do have one. Everything else on this
 * page is a convenience; that part is a claim about what is known.
 */
import { describe, expect, it } from 'vitest'
import {
  filterPortfolios,
  sortPortfolios,
  summarisePortfolio,
  type DirectoryInput,
  type PortfolioSummary,
} from './directory'
import { addDays } from './dates'

const INCEPTION = '2025-01-06'

const WEEKLY_GROWTH = 0.002

/**
 * A weekly series of `count` readings, each WEEKLY_GROWTH up on the last.
 *
 * `topUp` adds money to the balance at the start of the given week, after
 * which it compounds along with everything else — which is what a real
 * contribution does, and what makes it distinguishable from performance.
 */
function weekly(count: number, topUp?: { atWeek: number; pence: number }) {
  const readings = []
  let value = 100_000
  for (let week = 1; week <= count; week++) {
    value = Math.round(value * (1 + WEEKLY_GROWTH))
    if (topUp && week === topUp.atWeek) value += topUp.pence
    readings.push({ valuationDate: addDays(INCEPTION, week * 7), valuePence: value })
  }
  return readings
}

function input(overrides: Partial<DirectoryInput> = {}): DirectoryInput {
  return {
    providerSlug: 'northgate',
    providerName: 'Northgate',
    slug: 'balanced',
    name: 'Balanced',
    riskLabel: '5',
    wrapper: 'ISA',
    styleFamily: 'multi-asset',
    inceptionDate: INCEPTION,
    initialPence: 100_000,
    readings: weekly(12),
    flows: [{ effectiveDate: INCEPTION, amountPence: 100_000, kind: 'initial' }],
    ...overrides,
  }
}

function summary(overrides: Partial<PortfolioSummary> = {}): PortfolioSummary {
  return {
    providerSlug: 'northgate',
    providerName: 'Northgate',
    slug: 'balanced',
    name: 'Balanced',
    riskLabel: '5',
    wrapper: 'ISA',
    styleFamily: 'multi-asset',
    inceptionDate: INCEPTION,
    readingCount: 12,
    weeksRunning: 12,
    lastValuationDate: '2025-03-31',
    returnFraction: 0.02,
    isThin: false,
    ...overrides,
  }
}

describe('summarisePortfolio', () => {
  it('reports the return, reading count and span of a full series', () => {
    const result = summarisePortfolio(input())

    expect(result.readingCount).toBe(12)
    expect(result.weeksRunning).toBe(12)
    expect(result.lastValuationDate).toBe(addDays(INCEPTION, 84))
    expect(result.isThin).toBe(false)
    // 1.002^12 - 1 = 0.024266, less the sub-penny rounded off each week: the
    // fixture holds whole pence, as the schema does.
    expect(result.returnFraction).toBeCloseTo(0.02426, 5)
  })

  it('publishes no return for a thin series, rather than a small one', () => {
    const result = summarisePortfolio(input({ readings: weekly(3) }))

    expect(result.isThin).toBe(true)
    expect(result.readingCount).toBe(3)
    // Not 0, and not the arithmetically-correct 0.6% — absent.
    expect(result.returnFraction).toBeNull()
  })

  it('counts observations only — the inception point is not a reading', () => {
    // Exactly at the threshold: 4 readings publishes, 3 does not. If the
    // opening position were counted, 3 readings would slip through as 4.
    expect(summarisePortfolio(input({ readings: weekly(4) })).returnFraction).not.toBeNull()
    expect(summarisePortfolio(input({ readings: weekly(3) })).returnFraction).toBeNull()
  })

  it('reports a portfolio with no readings at all as thin and unrun', () => {
    const result = summarisePortfolio(input({ readings: [] }))

    expect(result.isThin).toBe(true)
    expect(result.returnFraction).toBeNull()
    expect(result.weeksRunning).toBe(0)
    expect(result.lastValuationDate).toBe(INCEPTION)
  })

  it('excludes contributions from the return, as the engine does', () => {
    // A £1,000 top-up mid-series must not read as performance. The unit-price
    // mechanism handles this; the summary must not undo it by falling back to
    // a value comparison, which would report the portfolio as having doubled.
    const readings = weekly(12, { atWeek: 6, pence: 100_000 })
    const withFlow = summarisePortfolio(
      input({
        readings,
        flows: [
          { effectiveDate: INCEPTION, amountPence: 100_000, kind: 'initial' },
          { effectiveDate: addDays(INCEPTION, 42), amountPence: 100_000, kind: 'contribution' },
        ],
      }),
    )

    const naive = readings[readings.length - 1]!.valuePence / 100_000 - 1
    expect(naive).toBeGreaterThan(1) // the value did more than double
    expect(withFlow.returnFraction!).toBeLessThan(0.05)

    // Within 0.11 percentage points of the same walk with no contribution at
    // all — near enough that the top-up is plainly not being read as growth,
    // but deliberately not asserted as identical.
    //
    // The residual gap is a real property of the rule the brief specifies,
    // not noise: a flow buys units at the last price STRICTLY BEFORE its
    // date, so money that arrives during week six is priced at week five's
    // price and collects that week's growth in unit terms. Half the portfolio
    // gaining an extra 0.2% week is the ~0.1pp seen here. Asserting exact
    // equivalence would mean either abandoning that rule or fudging the
    // fixture until it hid the effect.
    const noFlow = summarisePortfolio(input()).returnFraction!
    expect(Math.abs(withFlow.returnFraction! - noFlow)).toBeLessThan(0.0011)
  })
})

describe('filterPortfolios', () => {
  const rows = [
    summary({ providerName: 'Northgate', name: 'Balanced', riskLabel: '5', wrapper: 'ISA' }),
    summary({ providerName: 'Northgate', name: 'Cautious', riskLabel: '3', wrapper: 'GIA' }),
    summary({ providerName: 'Bramble', name: 'Managed Growth', riskLabel: '7', wrapper: 'ISA' }),
  ]

  it('returns everything for an empty or whitespace query', () => {
    expect(filterPortfolios(rows, '')).toHaveLength(3)
    expect(filterPortfolios(rows, '   ')).toHaveLength(3)
  })

  it('matches on provider or portfolio name, case-insensitively', () => {
    expect(filterPortfolios(rows, 'northgate')).toHaveLength(2)
    expect(filterPortfolios(rows, 'BRAMBLE')).toHaveLength(1)
    expect(filterPortfolios(rows, 'cautious')[0]?.name).toBe('Cautious')
  })

  it('matches a substring, not just a prefix', () => {
    expect(filterPortfolios(rows, 'growth')[0]?.name).toBe('Managed Growth')
  })

  it('requires every token but lets each match a different field', () => {
    // "northgate isa" is one provider and one wrapper — no single field
    // contains both, so a whole-string match would find nothing.
    const found = filterPortfolios(rows, 'northgate isa')
    expect(found).toHaveLength(1)
    expect(found[0]?.name).toBe('Balanced')
  })

  it('returns nothing when a token matches nothing', () => {
    expect(filterPortfolios(rows, 'northgate pension')).toHaveLength(0)
  })

  it('ignores slugs, which are URL plumbing rather than something to search', () => {
    expect(filterPortfolios(rows, 'balanced')).toHaveLength(1)
    expect(
      filterPortfolios([summary({ name: 'Adventurous', slug: 'kestrel-x' })], 'kestrel-x'),
    ).toHaveLength(0)
  })
})

describe('sortPortfolios', () => {
  const thin = summary({ providerName: 'Aldworth', name: 'New', returnFraction: null, isThin: true, weeksRunning: 2 })
  const flat = summary({ providerName: 'Bramble', name: 'Flat', returnFraction: 0, weeksRunning: 40 })
  const up = summary({ providerName: 'Northgate', name: 'Up', returnFraction: 0.08, weeksRunning: 30 })
  const down = summary({ providerName: 'Kestrel', name: 'Down', returnFraction: -0.05, weeksRunning: 52 })
  const rows = [thin, flat, up, down]

  it('sorts by provider then portfolio name', () => {
    expect(sortPortfolios(rows, 'provider').map((r) => r.providerName)).toEqual([
      'Aldworth',
      'Bramble',
      'Kestrel',
      'Northgate',
    ])
  })

  it('sorts by return, best first', () => {
    expect(sortPortfolios(rows, 'return').slice(0, 3).map((r) => r.name)).toEqual([
      'Up',
      'Flat',
      'Down',
    ])
  })

  it('places a portfolio with no published return last, not among the flat ones', () => {
    // The distinction the whole gate exists to protect: null is not zero, so
    // the thin portfolio must sit below the one that genuinely went nowhere.
    const byReturn = sortPortfolios(rows, 'return')
    expect(byReturn[byReturn.length - 1]?.name).toBe('New')
    expect(byReturn.indexOf(flat)).toBeLessThan(byReturn.indexOf(thin))
  })

  it('ranks a thin portfolio on the sort key itself when that key is not return', () => {
    // Deliberately NOT bottom-of-the-list here. Sorting by time running is a
    // statement about time: a portfolio open 99 weeks has been open 99 weeks
    // whatever its reading count, and demoting it would be its own small
    // distortion. Only the return sort has a return to protect, and the row
    // still shows a reading count where a figure would otherwise be.
    const longThin = { ...thin, weeksRunning: 99 }
    const byRunning = sortPortfolios([longThin, flat, up, down], 'running')
    expect(byRunning[0]?.name).toBe('New')
    expect(byRunning[0]?.returnFraction).toBeNull()

    // ...but the same portfolio is still last once returns are what is ranked.
    const byReturn = sortPortfolios([longThin, flat, up, down], 'return')
    expect(byReturn[byReturn.length - 1]?.name).toBe('New')
  })

  it('sorts by time running, longest first', () => {
    expect(sortPortfolios(rows, 'running').map((r) => r.weeksRunning)).toEqual([52, 40, 30, 2])
  })

  it('does not mutate the array it was given', () => {
    const original = [...rows]
    sortPortfolios(rows, 'return')
    expect(rows).toEqual(original)
  })
})
