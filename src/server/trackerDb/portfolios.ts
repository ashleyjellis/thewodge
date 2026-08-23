/**
 * Portfolio reads for the admin panel and the public pages.
 */
import { and, desc, eq } from 'drizzle-orm'
import type { TrackerDb } from './client.js'
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
