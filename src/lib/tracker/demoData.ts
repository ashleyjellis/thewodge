/**
 * The demo dataset — fictional providers, fabricated performance.
 *
 * Pure: builds and returns plain objects, touching no database. That keeps it
 * testable, and keeps the decision about *whether* it is safe to write this
 * anywhere in the script that does the writing.
 *
 * ## Why fictional names matter
 *
 * Every provider here is invented. Attaching fabricated performance figures
 * to a real regulated firm would be a serious problem the moment a screenshot
 * left someone's laptop — and screenshots always leave. Northgate, Bramble,
 * Kestrel, Aldworth, Pennine and Foxglove exist so that a leaked image is
 * obviously a mock rather than a defamatory claim about a real business.
 *
 * ## Reproducibility
 *
 * The random walk runs off a fixed PRNG seed, so the same shape comes back
 * every time. Dates are anchored to a reference date that defaults to today,
 * because demo data showing a series that ended eight months ago reads as
 * broken rather than as a demo. Pass a fixed reference date to get a fully
 * deterministic dataset for tests.
 *
 * ## The hand-forced cases
 *
 * The random walk alone produces eighteen portfolios that all look roughly
 * the same and exercise roughly one UI state. The cases below are each forced
 * deliberately, because each one exists to make a state real before there is
 * any real data to produce it: an unrecovered drawdown, a three-reading
 * portfolio too young to say anything about, missing weeks, contributions
 * pulling time-weighted and simple return apart.
 */
import { MICRO, unitsForAmountMicro, valueFromUnits } from './money'
import { addDays } from './dates'
import type { AssetClass, FlowKind, StyleFamily, Wrapper } from '@/server/trackerDb/schema'

export const DEMO_SEED = 20260101

/** Deterministic PRNG — mulberry32. Small, fast, and repeatable across runs. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Box-Muller, for normally distributed weekly returns. */
function normal(rand: () => number): number {
  const u = Math.max(rand(), Number.EPSILON)
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export type DemoProvider = {
  slug: string
  name: string
  website: string
  /** flat annual fee in bps, or null when the provider uses tiers */
  platformFeeBps: number | null
  feeTiers: { upto_pence: number | null; bps: number }[] | null
}

export const DEMO_PROVIDERS: DemoProvider[] = [
  {
    slug: 'northgate',
    name: 'Northgate',
    website: 'https://northgate.example',
    platformFeeBps: null,
    feeTiers: [
      { upto_pence: 1_000_000, bps: 75 },
      { upto_pence: null, bps: 35 },
    ],
  },
  {
    slug: 'bramble',
    name: 'Bramble',
    website: 'https://bramble.example',
    platformFeeBps: 45,
    feeTiers: null,
  },
  {
    slug: 'kestrel',
    name: 'Kestrel',
    website: 'https://kestrel.example',
    platformFeeBps: null,
    feeTiers: [
      { upto_pence: 2_500_000, bps: 60 },
      { upto_pence: null, bps: 30 },
    ],
  },
  {
    slug: 'aldworth',
    name: 'Aldworth',
    website: 'https://aldworth.example',
    platformFeeBps: 75,
    feeTiers: null,
  },
  {
    slug: 'pennine',
    name: 'Pennine',
    website: 'https://pennine.example',
    platformFeeBps: null,
    feeTiers: [
      { upto_pence: 500_000, bps: 90 },
      { upto_pence: 5_000_000, bps: 50 },
      { upto_pence: null, bps: 25 },
    ],
  },
  {
    slug: 'foxglove',
    name: 'Foxglove',
    website: 'https://foxglove.example',
    platformFeeBps: 35,
    feeTiers: null,
  },
]

/** The three risk levels every provider offers, with plausible characteristics. */
const RISK_LEVELS = [
  { label: '3/10', slug: 'cautious', name: 'Fully Managed — Cautious', drift: 0.035, vol: 0.06 },
  { label: '5/10', slug: 'balanced', name: 'Fully Managed — Balanced', drift: 0.055, vol: 0.1 },
  { label: '8/10', slug: 'adventurous', name: 'Fully Managed — Adventurous', drift: 0.075, vol: 0.16 },
] as const

export type DemoPortfolio = {
  providerSlug: string
  slug: string
  name: string
  providerRiskLabel: string
  styleFamily: StyleFamily
  wrapper: Wrapper
  inceptionDate: string
  accountOpenDate: string
  initialPence: number
  platformFeeBps: number | null
  feeTiersJson: string | null
  ocfBps: number
  readings: { valuationDate: string; valuePence: number; source: 'web' | 'app' | 'statement' }[]
  flows: { effectiveDate: string; amountPence: number; kind: FlowKind }[]
  /** what this portfolio exists to demonstrate — shown nowhere, kept for humans */
  demonstrates: string
}

type WalkOptions = {
  weeks: number
  drift: number
  vol: number
  initialPence: number
  inceptionDate: string
  rand: () => number
  /** weekly contribution in pence, applied from week 1 */
  weeklyContributionPence?: number
  /** week indices (1-based) to omit a reading for */
  skipWeeks?: number[]
  /** forces a fall of this depth starting at this week, optionally recovering */
  forcedFall?: { startWeek: number; depth: number; recoverByWeek: number | null }
}

/**
 * Simulates a portfolio week by week and emits readings consistent with its
 * flows.
 *
 * The consistency matters: readings are the source of truth and the engine
 * derives the unit price from them, so a value that ignored a contribution
 * would make the derived price lurch on the day money went in — inventing a
 * gain or loss that never happened. Contributions are therefore priced at the
 * previous week's price, exactly as the engine will re-derive them.
 */
function walk(options: WalkOptions) {
  const {
    weeks,
    drift,
    vol,
    initialPence,
    inceptionDate,
    rand,
    weeklyContributionPence,
    skipWeeks = [],
    forcedFall,
  } = options

  const weeklyVol = vol / Math.sqrt(52)
  const weeklyDrift = drift / 52 - (weeklyVol * weeklyVol) / 2
  const FALL_WEEKS = 6

  let unitsMicro = initialPence * MICRO
  let priceMicro = MICRO
  // The running high-water mark, because a drawdown is measured from the peak
  // that stood before the fall — not from wherever the price happened to be
  // when the fall was scheduled to start. Steering the fall by overriding
  // weekly returns instead produced a 22% drawdown when 12% was intended: the
  // walk had already drifted down 11% from an earlier peak, and the forced
  // fall stacked on top of that.
  let peakMicro = MICRO
  let troughTargetMicro: number | null = null
  let recoveryTargetMicro: number | null = null

  const readings: DemoPortfolio['readings'] = []
  const flows: DemoPortfolio['flows'] = [
    { effectiveDate: inceptionDate, amountPence: initialPence, kind: 'initial' },
  ]

  for (let week = 1; week <= weeks; week++) {
    const date = addDays(inceptionDate, week * 7)

    if (weeklyContributionPence) {
      unitsMicro += unitsForAmountMicro(weeklyContributionPence, priceMicro)
      flows.push({
        effectiveDate: date,
        amountPence: weeklyContributionPence,
        kind: 'contribution',
      })
    }

    if (forcedFall && week === forcedFall.startWeek + 1) {
      troughTargetMicro = Math.round(peakMicro * (1 + forcedFall.depth))
      // Clear the old peak on recovery rather than merely matching it, so the
      // recovered state is unambiguous.
      recoveryTargetMicro = Math.round(peakMicro * 1.02)
    }

    const inFall =
      forcedFall && week > forcedFall.startWeek && week <= forcedFall.startWeek + FALL_WEEKS
    const inClimb =
      forcedFall?.recoverByWeek != null &&
      week > forcedFall.startWeek + FALL_WEEKS &&
      week <= forcedFall.recoverByWeek
    const stayingDown =
      forcedFall && forcedFall.recoverByWeek === null && week > forcedFall.startWeek + FALL_WEEKS

    if (inFall && troughTargetMicro) {
      // Aim at the trough from wherever we actually are, over the steps left,
      // so the depth lands exactly regardless of what the walk did before.
      const stepsLeft = forcedFall.startWeek + FALL_WEEKS - week + 1
      priceMicro = Math.round(
        priceMicro * Math.exp(Math.log(troughTargetMicro / priceMicro) / stepsLeft),
      )
    } else if (inClimb && recoveryTargetMicro && forcedFall?.recoverByWeek) {
      const stepsLeft = forcedFall.recoverByWeek - week + 1
      priceMicro = Math.round(
        priceMicro * Math.exp(Math.log(recoveryTargetMicro / priceMicro) / stepsLeft),
      )
    } else if (stayingDown) {
      // Drifts sideways, bounded on both sides: never back above the old peak
      // (this portfolio exists to keep the unrecovered state on screen) and
      // never below the trough it was steered to (or the deepest drawdown
      // would be whatever the wander happened to reach rather than the depth
      // the case specifies).
      priceMicro = Math.round(priceMicro * Math.exp(weeklyVol * normal(rand) * 0.4))
      priceMicro = Math.min(priceMicro, Math.round(peakMicro * 0.95))
      if (troughTargetMicro) priceMicro = Math.max(priceMicro, troughTargetMicro)
    } else {
      priceMicro = Math.round(priceMicro * Math.exp(weeklyDrift + weeklyVol * normal(rand)))
    }

    if (priceMicro > peakMicro) peakMicro = priceMicro

    if (!skipWeeks.includes(week)) {
      readings.push({
        valuationDate: date,
        valuePence: valueFromUnits(unitsMicro, priceMicro),
        source: week % 7 === 0 ? 'app' : 'web',
      })
    }
  }

  return { readings, flows }
}

export type DemoDataset = ReturnType<typeof buildDemoDataset>

export function buildDemoDataset(referenceDate = new Date().toISOString().slice(0, 10)) {
  const rand = mulberry32(DEMO_SEED)

  const portfolios: DemoPortfolio[] = []

  // Cases forced onto specific portfolios, each making one UI state real.
  const forced: Record<string, Partial<WalkOptions> & { demonstrates: string }> = {
    'northgate-balanced': {
      forcedFall: { startWeek: 18, depth: -0.12, recoverByWeek: 40 },
      demonstrates: 'a 12% fall that fully recovers — drawdown band and recovery duration',
    },
    'bramble-adventurous': {
      forcedFall: { startWeek: 30, depth: -0.15, recoverByWeek: null },
      demonstrates: 'a fall that has not recovered — the null recovery state',
    },
    'kestrel-cautious': {
      weeks: 12,
      demonstrates: 'inception 12 weeks ago — short series, statistics suppressed',
    },
    'aldworth-cautious': {
      weeks: 3,
      demonstrates: 'three readings only — the thin state, too early to mean anything',
    },
    'pennine-balanced': {
      skipWeeks: [22, 23],
      demonstrates: 'two missing weeks mid-series — forward-fill rendering',
    },
    'foxglove-balanced': {
      weeklyContributionPence: 2_500,
      demonstrates: '£25 a week paid in — time-weighted and simple return diverge',
    },
  }

  for (const provider of DEMO_PROVIDERS) {
    for (const risk of RISK_LEVELS) {
      const key = `${provider.slug}-${risk.slug}`
      const override = forced[key]
      const weeks = override?.weeks ?? 52
      const inceptionDate = addDays(referenceDate, -(weeks * 7) - 3)

      const { readings, flows } = walk({
        weeks,
        drift: risk.drift,
        vol: risk.vol,
        initialPence: 50_000,
        inceptionDate,
        rand,
        weeklyContributionPence: override?.weeklyContributionPence,
        skipWeeks: override?.skipWeeks,
        forcedFall: override?.forcedFall,
      })

      portfolios.push({
        providerSlug: provider.slug,
        slug: `fully-managed-${risk.slug}`,
        name: risk.name,
        providerRiskLabel: risk.label,
        styleFamily: 'mainstream',
        wrapper: 'isa',
        inceptionDate,
        // providers routinely open the account a few days before the cash
        // actually lands, and the gap is itself worth publishing
        accountOpenDate: addDays(inceptionDate, -3),
        initialPence: 50_000,
        platformFeeBps: provider.platformFeeBps,
        feeTiersJson: provider.feeTiers ? JSON.stringify(provider.feeTiers) : null,
        ocfBps: 15 + Math.floor(rand() * 10),
        readings,
        flows,
        demonstrates: override?.demonstrates ?? 'a standard 52-week series',
      })
    }
  }

  // Monthly composition for three portfolios — including a cash weighting, so
  // the page can show cash drag rather than implying everything is invested.
  const holdingsFor = ['northgate-balanced', 'bramble-adventurous', 'kestrel-cautious']
  const holdings = holdingsFor.flatMap((key) => {
    const portfolio = portfolios.find((p) => `${p.providerSlug}-${p.slug.split('-').pop()}` === key)
    if (!portfolio) return []
    const months = [0, 1, 2].map((m) => addDays(referenceDate, -30 * m))
    const composition: { name: string; assetClass: AssetClass; region: string | null; bps: number }[] =
      [
        { name: 'Global Equity Index Fund', assetClass: 'equity', region: 'Global', bps: 4_800 },
        { name: 'UK Equity Index Fund', assetClass: 'equity', region: 'UK', bps: 1_200 },
        { name: 'Global Aggregate Bond Fund', assetClass: 'bond', region: 'Global', bps: 2_600 },
        { name: 'Short-Dated Gilt Fund', assetClass: 'bond', region: 'UK', bps: 900 },
        { name: 'Cash', assetClass: 'cash', region: null, bps: 500 },
      ]
    return months.flatMap((asOfDate) =>
      composition.map((holding) => ({
        providerSlug: portfolio.providerSlug,
        portfolioSlug: portfolio.slug,
        asOfDate,
        instrumentName: holding.name,
        assetClass: holding.assetClass,
        region: holding.region,
        weightBps: holding.bps,
        isin: null,
      })),
    )
  })

  // Benchmarks — relative volatility needs something to be relative to.
  const benchmarkRand = mulberry32(DEMO_SEED + 1)
  const benchmarks = [
    { code: 'GLOBAL_EQUITY', name: 'Global equity', vol: 0.15, drift: 0.07 },
    { code: 'GLOBAL_BOND', name: 'Global bond', vol: 0.05, drift: 0.03 },
  ].map((benchmark) => {
    const weeklyVol = benchmark.vol / Math.sqrt(52)
    const weeklyDrift = benchmark.drift / 52 - (weeklyVol * weeklyVol) / 2
    let level = 1_000_000
    const readings: { onDate: string; levelMicro: number }[] = []
    for (let week = 52; week >= 0; week--) {
      level = Math.round(level * Math.exp(weeklyDrift + weeklyVol * normal(benchmarkRand)))
      readings.push({ onDate: addDays(referenceDate, -week * 7), levelMicro: level })
    }
    return { code: benchmark.code, name: benchmark.name, readings }
  })

  const notes = [
    {
      slug: 'why-this-exists',
      title: 'Why this exists',
      publishedAt: addDays(referenceDate, -21),
      bodyMd:
        'Nobody publishes what a managed portfolio actually did with real money, ' +
        'week by week, with the evidence attached. So this does.\n\nEvery figure here ' +
        'is currently fabricated demo data — see the banner. The mechanic is what is ' +
        'being tested, not the numbers.',
    },
    {
      slug: 'on-drawdowns',
      title: 'The number that matters is the fall',
      publishedAt: addDays(referenceDate, -14),
      bodyMd:
        'Growth figures are easy to look at. The fall is the one that decides whether ' +
        'someone stays invested, which is why it gets more space here than the gain.',
    },
    {
      slug: 'first-twelve-weeks',
      title: 'Twelve weeks in, and that is the point',
      publishedAt: addDays(referenceDate, -7),
      bodyMd:
        'A portfolio with three readings tells you nothing. Publishing it anyway, ' +
        'clearly labelled as telling you nothing, is more honest than waiting until ' +
        'the series is long enough to flatter someone.',
    },
  ]

  // Mixed confirmation states, so the admin subscriber view has something
  // real to render rather than a uniformly happy list.
  const subscribers = Array.from({ length: 20 }, (_, i) => ({
    email: `demo-subscriber-${i + 1}@example.com`,
    confirmedAt: i % 3 === 0 ? null : addDays(referenceDate, -(i + 1)),
    unsubToken: `demo-unsub-${(i + 1).toString().padStart(3, '0')}`,
  }))

  return { providers: DEMO_PROVIDERS, portfolios, holdings, benchmarks, notes, subscribers }
}
