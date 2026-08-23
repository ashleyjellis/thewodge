/**
 * Writes the demo dataset into the tracker database.
 *
 *   pnpm tracker:seed:demo    build and insert (refuses if demo data exists)
 *   pnpm tracker:seed:reset   remove existing demo data first, then insert
 *
 * The dataset itself is built by src/lib/tracker/demoData.ts, which is pure.
 * This script exists to do the two things that generator deliberately does
 * not: decide whether writing is safe, and write.
 *
 * ## Two guards, because one is not enough
 *
 * The brief requires that seeding never runs against a database where
 * DEMO_MODE is off. That is checked here against process.env rather than the
 * DEMO_MODE constant in src/config.ts, which reads import.meta.env — undefined
 * under Node, so importing it here would make the flag read as "on" always
 * and the guard would never fire.
 *
 * The second guard is the one that would actually save someone: it refuses if
 * the database already contains a provider that is not marked as demo.
 * Environment variables get misconfigured and command history gets re-run;
 * the presence of real data in the database is a fact about the database, and
 * it is the thing that matters. Fabricated performance written into a
 * database holding a real published record would be far worse than a failed
 * command.
 */
import 'dotenv/config'
import { eq, inArray } from 'drizzle-orm'
import { buildDemoDataset } from '../src/lib/tracker/demoData'
import { getTrackerDb, closeTrackerDb } from '../src/server/trackerDb/client'
import * as schema from '../src/server/trackerDb/schema'

const reset = process.argv.includes('--reset')
const db = getTrackerDb()

function fail(message: string): never {
  console.error(`[tracker-seed] refusing: ${message}`)
  process.exit(1)
}

// Guard 1 — the environment says this is not a demo database.
if (process.env.VITE_DEMO_MODE === '0') {
  fail('VITE_DEMO_MODE is 0. Demo data must never be written to a live database.')
}

// Guard 2 — the database itself contains something real.
const realProviders = await db
  .select({ id: schema.providers.id, name: schema.providers.name })
  .from(schema.providers)
  .where(eq(schema.providers.isDemo, false))

if (realProviders.length > 0) {
  fail(
    `this database holds ${realProviders.length} non-demo provider(s) — ` +
      `${realProviders.map((p) => p.name).join(', ')}. It is a real record, not a demo.`,
  )
}

// Built before the reset so its own keys can drive the deletion: benchmarks,
// global notes and subscribers have no provider to hang off, so "delete
// everything belonging to the demo providers" would miss them and the next
// insert would collide on a unique code, slug or email.
const dataset = buildDemoDataset()

const existingDemo = await db
  .select({ id: schema.providers.id })
  .from(schema.providers)
  .where(eq(schema.providers.isDemo, true))

if (existingDemo.length > 0) {
  if (!reset) {
    fail(
      `${existingDemo.length} demo provider(s) already present. ` +
        'Re-run with `pnpm tracker:seed:reset` to replace them.',
    )
  }
  console.log(`[tracker-seed] clearing ${existingDemo.length} existing demo provider(s)`)

  const demoProviderIds = existingDemo.map((p) => p.id)
  const demoPortfolios = await db
    .select({ id: schema.portfolios.id })
    .from(schema.portfolios)
    .where(inArray(schema.portfolios.providerId, demoProviderIds))
  const portfolioIds = demoPortfolios.map((p) => p.id)

  // Deleted child-first: these foreign keys are ON DELETE no action, so a
  // parent removed while children still reference it would fail the
  // constraint rather than cascade.
  if (portfolioIds.length > 0) {
    await db.delete(schema.seriesCache).where(inArray(schema.seriesCache.portfolioId, portfolioIds))
    await db.delete(schema.readings).where(inArray(schema.readings.portfolioId, portfolioIds))
    await db.delete(schema.flows).where(inArray(schema.flows.portfolioId, portfolioIds))
    await db.delete(schema.feeEvents).where(inArray(schema.feeEvents.portfolioId, portfolioIds))
    await db.delete(schema.holdings).where(inArray(schema.holdings.portfolioId, portfolioIds))
    await db
      .delete(schema.alertSubscriptions)
      .where(inArray(schema.alertSubscriptions.portfolioId, portfolioIds))
    await db.delete(schema.notes).where(inArray(schema.notes.portfolioId, portfolioIds))
  }
  await db.delete(schema.portfolios).where(inArray(schema.portfolios.providerId, demoProviderIds))
  await db.delete(schema.providers).where(inArray(schema.providers.id, demoProviderIds))

  // Rows with no provider to hang off. Deleted by the exact keys this seed
  // creates rather than by clearing the tables, so anything a human added by
  // hand while testing survives.
  const benchmarkCodes = dataset.benchmarks.map((b) => b.code)
  const existingBenchmarks = await db
    .select({ id: schema.benchmarks.id })
    .from(schema.benchmarks)
    .where(inArray(schema.benchmarks.code, benchmarkCodes))
  if (existingBenchmarks.length > 0) {
    const ids = existingBenchmarks.map((b) => b.id)
    await db.delete(schema.benchmarkReadings).where(inArray(schema.benchmarkReadings.benchmarkId, ids))
    await db.delete(schema.benchmarks).where(inArray(schema.benchmarks.id, ids))
  }
  await db.delete(schema.notes).where(inArray(schema.notes.slug, dataset.notes.map((n) => n.slug)))
  await db
    .delete(schema.subscribers)
    .where(inArray(schema.subscribers.email, dataset.subscribers.map((s) => s.email)))
}

console.log('[tracker-seed] building demo dataset')

const providerIdBySlug = new Map<string, number>()
for (const provider of dataset.providers) {
  const [row] = await db
    .insert(schema.providers)
    .values({
      slug: provider.slug,
      name: provider.name,
      website: provider.website,
      isDemo: true,
    })
    .returning({ id: schema.providers.id })
  providerIdBySlug.set(provider.slug, row!.id)
}

const portfolioIdByKey = new Map<string, number>()
let readingCount = 0
let flowCount = 0

for (const portfolio of dataset.portfolios) {
  const providerId = providerIdBySlug.get(portfolio.providerSlug)!
  const [row] = await db
    .insert(schema.portfolios)
    .values({
      providerId,
      slug: portfolio.slug,
      name: portfolio.name,
      providerRiskLabel: portfolio.providerRiskLabel,
      styleFamily: portfolio.styleFamily,
      wrapper: portfolio.wrapper,
      inceptionDate: portfolio.inceptionDate,
      accountOpenDate: portfolio.accountOpenDate,
      initialPence: portfolio.initialPence,
      platformFeeBps: portfolio.platformFeeBps,
      feeTiersJson: portfolio.feeTiersJson,
      ocfBps: portfolio.ocfBps,
    })
    .returning({ id: schema.portfolios.id })

  const portfolioId = row!.id
  portfolioIdByKey.set(`${portfolio.providerSlug}/${portfolio.slug}`, portfolioId)

  for (const reading of portfolio.readings) {
    await db.insert(schema.readings).values({
      portfolioId,
      valuationDate: reading.valuationDate,
      // A reading is a human looking at a screen, typically a day or two
      // after the valuation date the provider quotes.
      readAt: `${reading.valuationDate}T09:15:00Z`,
      valuePence: reading.valuePence,
      source: reading.source,
    })
    readingCount++
  }

  for (const flow of portfolio.flows) {
    await db.insert(schema.flows).values({
      portfolioId,
      effectiveDate: flow.effectiveDate,
      amountPence: flow.amountPence,
      kind: flow.kind,
    })
    flowCount++
  }
}

for (const holding of dataset.holdings) {
  const portfolioId = portfolioIdByKey.get(`${holding.providerSlug}/${holding.portfolioSlug}`)
  if (!portfolioId) continue
  await db.insert(schema.holdings).values({
    portfolioId,
    asOfDate: holding.asOfDate,
    isin: holding.isin,
    instrumentName: holding.instrumentName,
    assetClass: holding.assetClass,
    region: holding.region,
    weightBps: holding.weightBps,
  })
}

for (const benchmark of dataset.benchmarks) {
  const [row] = await db
    .insert(schema.benchmarks)
    .values({ code: benchmark.code, name: benchmark.name })
    .returning({ id: schema.benchmarks.id })
  for (const reading of benchmark.readings) {
    await db.insert(schema.benchmarkReadings).values({
      benchmarkId: row!.id,
      onDate: reading.onDate,
      levelMicro: reading.levelMicro,
    })
  }
}

for (const note of dataset.notes) {
  await db.insert(schema.notes).values({
    portfolioId: null,
    publishedAt: note.publishedAt,
    title: note.title,
    bodyMd: note.bodyMd,
    slug: note.slug,
  })
}

for (const subscriber of dataset.subscribers) {
  await db.insert(schema.subscribers).values({
    email: subscriber.email,
    confirmedAt: subscriber.confirmedAt,
    unsubToken: subscriber.unsubToken,
  })
}

console.log(
  `[tracker-seed] done — ${dataset.providers.length} providers, ` +
    `${dataset.portfolios.length} portfolios, ${readingCount} readings, ${flowCount} flows, ` +
    `${dataset.holdings.length} holdings, ${dataset.benchmarks.length} benchmarks, ` +
    `${dataset.notes.length} notes, ${dataset.subscribers.length} subscribers`,
)
console.log('[tracker-seed] every provider is fictional and marked is_demo = 1')

await closeTrackerDb()
process.exit(0)
