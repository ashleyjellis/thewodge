/**
 * Portfolio reads for the admin panel and the public pages.
 */
import { and, desc, eq } from 'drizzle-orm'
import type { DirectoryInput } from '../../lib/tracker/directory.js'
import type { TrackerDb } from './client.js'
import { flowsForPortfolios, readingsForPortfolios } from './readings.js'
import { portfolios, providers, readings } from './schema.js'

export type PortfolioRow = typeof portfolios.$inferSelect
export type ProviderRow = typeof providers.$inferSelect

export type PortfolioWithProvider = PortfolioRow & {
  providerName: string
  providerSlug: string
  isDemo: boolean
}

export async function listActivePortfolios(db: TrackerDb): Promise<PortfolioWithProvider[]> {
  const rows = await db
    .select({ portfolio: portfolios, provider: providers })
    .from(portfolios)
    .innerJoin(providers, eq(providers.id, portfolios.providerId))
    .where(eq(portfolios.status, 'active'))

  return rows
    .map(({ portfolio, provider }) => ({
      ...portfolio,
      providerName: provider.name,
      providerSlug: provider.slug,
      isDemo: provider.isDemo,
    }))
    .sort(
      (a, b) =>
        a.providerName.localeCompare(b.providerName) || a.name.localeCompare(b.name),
    )
}

export async function findPortfolio(
  db: TrackerDb,
  providerSlug: string,
  portfolioSlug: string,
): Promise<PortfolioWithProvider | null> {
  const rows = await db
    .select({ portfolio: portfolios, provider: providers })
    .from(portfolios)
    .innerJoin(providers, eq(providers.id, portfolios.providerId))
    .where(and(eq(providers.slug, providerSlug), eq(portfolios.slug, portfolioSlug)))

  const row = rows[0]
  if (!row) return null
  return {
    ...row.portfolio,
    providerName: row.provider.name,
    providerSlug: row.provider.slug,
    isDemo: row.provider.isDemo,
  }
}

/**
 * Everything the public index needs, in three queries rather than three per
 * portfolio.
 *
 * The index summarises every active portfolio, and the obvious shape — loop
 * the list, fetch each one's readings and flows — is one round trip per
 * portfolio per table. Against Turso those are network calls, and the seed
 * script already demonstrated what that costs: the same n+1 pattern took over
 * seven minutes there before it was batched into single statements.
 *
 * So: one query for the portfolios, one for every reading, one for every
 * flow, then grouped in memory. Returns the engine's input shape rather than
 * a summary, because the arithmetic belongs in src/lib/tracker where it can
 * be tested without a database.
 */
export async function directoryInputs(db: TrackerDb): Promise<DirectoryInput[]> {
  const active = await listActivePortfolios(db)
  if (active.length === 0) return []

  const ids = active.map((portfolio) => portfolio.id)
  const [allReadings, allFlows] = await Promise.all([
    readingsForPortfolios(db, ids),
    flowsForPortfolios(db, ids),
  ])

  const readingsBy = new Map<number, DirectoryInput['readings']>()
  for (const reading of allReadings) {
    const list = readingsBy.get(reading.portfolioId) ?? []
    list.push({ valuationDate: reading.valuationDate, valuePence: reading.valuePence })
    readingsBy.set(reading.portfolioId, list)
  }

  const flowsBy = new Map<number, DirectoryInput['flows']>()
  for (const flow of allFlows) {
    const list = flowsBy.get(flow.portfolioId) ?? []
    list.push({
      effectiveDate: flow.effectiveDate,
      amountPence: flow.amountPence,
      kind: flow.kind,
    })
    flowsBy.set(flow.portfolioId, list)
  }

  return active.map((portfolio) => ({
    providerSlug: portfolio.providerSlug,
    providerName: portfolio.providerName,
    slug: portfolio.slug,
    name: portfolio.name,
    riskLabel: portfolio.providerRiskLabel,
    wrapper: portfolio.wrapper,
    styleFamily: portfolio.styleFamily,
    inceptionDate: portfolio.inceptionDate,
    initialPence: portfolio.initialPence,
    // buildSeries sorts internally, but the ordering is not guaranteed by the
    // batched read the way the per-portfolio query's ORDER BY guaranteed it.
    readings: (readingsBy.get(portfolio.id) ?? []).sort((a, b) =>
      a.valuationDate.localeCompare(b.valuationDate),
    ),
    flows: flowsBy.get(portfolio.id) ?? [],
  }))
}

/** The most recent reading per portfolio — what the weekly grid compares against. */
export async function latestReadingByPortfolio(
  db: TrackerDb,
): Promise<Map<number, { valuationDate: string; valuePence: number }>> {
  const rows = await db
    .select({
      portfolioId: readings.portfolioId,
      valuationDate: readings.valuationDate,
      valuePence: readings.valuePence,
    })
    .from(readings)
    .orderBy(readings.portfolioId, desc(readings.valuationDate))

  const latest = new Map<number, { valuationDate: string; valuePence: number }>()
  for (const row of rows) {
    if (!latest.has(row.portfolioId)) {
      latest.set(row.portfolioId, {
        valuationDate: row.valuationDate,
        valuePence: row.valuePence,
      })
    }
  }
  return latest
}
