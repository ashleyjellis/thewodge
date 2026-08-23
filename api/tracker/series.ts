/**
 * GET /api/tracker/series?provider=X&portfolio=Y — the series as CSV.
 *
 * Served from `series_cache` rather than rebuilt on the fly, because the
 * export's job is to let someone check the published figures against their
 * source. Recomputing here would mean the file was produced by a second run
 * of the engine, and a file that agrees with the page because both were
 * computed the same way proves less than one read straight from what the page
 * is drawn from. The cache is rebuilt on every write, so it cannot be stale
 * without the page being stale too.
 *
 * Falls back to computing the series when the cache is empty — a portfolio
 * whose readings predate the cache being introduced would otherwise export an
 * empty file that looks like "no data" rather than "not cached yet".
 */
import { eq } from 'drizzle-orm'
import { getTrackerDb } from '../../src/server/trackerDb/client.js'
import { findPortfolio } from '../../src/server/trackerDb/portfolios.js'
import { listReadings } from '../../src/server/trackerDb/readings.js'
import { flows as flowsTable, seriesCache } from '../../src/server/trackerDb/schema.js'
import { buildSeries } from '../../src/lib/tracker/series.js'
import { toCsv, type SeriesCsvRow } from '../../src/lib/tracker/csv.js'
import { isDemoMode } from '../../src/server/demoMode.js'
import { classifyDbFailure } from '../../src/server/trackerDb/errors.js'
import {
  methodNotAllowed,
  requireSend,
  type ApiRequest,
  type ApiResponse,
} from '../_lib/http.js'

function single(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    if (req.method !== 'GET') {
      methodNotAllowed(res)
      return
    }

    const providerSlug = single(req.query?.provider)
    const portfolioSlug = single(req.query?.portfolio)
    if (!providerSlug || !portfolioSlug) {
      res.status(400).json({ ok: false, error: 'provider and portfolio are required' })
      return
    }

    const db = getTrackerDb()
    const portfolio = await findPortfolio(db, providerSlug, portfolioSlug)
    if (!portfolio) {
      res.status(404).json({ ok: false, error: 'no such portfolio' })
      return
    }

    const cached = await db
      .select()
      .from(seriesCache)
      .where(eq(seriesCache.portfolioId, portfolio.id))
      .orderBy(seriesCache.onDate)

    let rows: SeriesCsvRow[] = cached.map((row) => ({
      onDate: row.onDate,
      unitPriceMicro: row.unitPriceMicro,
      unitsMicro: row.unitsMicro,
      valuePence: row.valuePence,
      isForwardFilled: row.isForwardFilled,
    }))

    if (rows.length === 0) {
      const [readings, portfolioFlows] = await Promise.all([
        listReadings(db, portfolio.id),
        db.select().from(flowsTable).where(eq(flowsTable.portfolioId, portfolio.id)),
      ])
      rows = buildSeries({
        inceptionDate: portfolio.inceptionDate,
        initialPence: portfolio.initialPence,
        readings,
        flows: portfolioFlows,
      }).map((point) => ({
        onDate: point.onDate,
        unitPriceMicro: point.unitPriceMicro,
        unitsMicro: point.unitsMicro,
        valuePence: point.valuePence,
        isForwardFilled: point.isForwardFilled,
      }))
    }

    const csv = toCsv(rows, {
      providerName: portfolio.providerName,
      providerSlug: portfolio.providerSlug,
      portfolioName: portfolio.name,
      portfolioSlug: portfolio.slug,
      generatedAt: new Date().toISOString(),
      isDemo: isDemoMode(),
    })

    const send = requireSend(res)
    res.setHeader?.('content-type', 'text/csv; charset=utf-8')
    // Slugs only in the filename — they are already URL-safe, so this cannot
    // carry a quote or a newline into the header.
    res.setHeader?.(
      'content-disposition',
      `attachment; filename="wodge-${portfolio.providerSlug}-${portfolio.slug}.csv"`,
    )
    res.status(200)
    send(csv)
  } catch (err) {
    console.error('[api/tracker/series]', err)
    res.status(500).json({
      ok: false,
      error: 'the tracker database could not be read',
      reason: classifyDbFailure(err),
    })
  }
}
