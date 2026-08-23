/**
 * GET /api/tracker/portfolio?provider=X&portfolio=Y
 *
 * Returns raw readings and flows rather than a computed series. The page has
 * live fee and modelled-balance controls that re-derive everything as they
 * change, so the engine has to run client-side anyway — and it can, being
 * pure with no database imports. Sending derived values as well would mean
 * the same numbers computed in two places, which is how two places start
 * disagreeing.
 *
 * GET /api/tracker/portfolio (no params) lists every portfolio, for the index.
 */
import { getTrackerDb } from '../../src/server/trackerDb/client.js'
import { findPortfolio, listActivePortfolios } from '../../src/server/trackerDb/portfolios.js'
import { listReadings } from '../../src/server/trackerDb/readings.js'
import { flows as flowsTable } from '../../src/server/trackerDb/schema.js'
import { eq } from 'drizzle-orm'
import { buildSeries } from '../../src/lib/tracker/series.js'
import { timeWeightedReturn } from '../../src/lib/tracker/returns.js'
import {
  methodNotAllowed,
  serverError,
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

    const db = getTrackerDb()
    const providerSlug = single(req.query?.provider)
    const portfolioSlug = single(req.query?.portfolio)

    if (!providerSlug || !portfolioSlug) {
      const all = await listActivePortfolios(db)
      res.status(200).json({
        ok: true,
        portfolios: all.map((portfolio) => ({
          providerSlug: portfolio.providerSlug,
          providerName: portfolio.providerName,
          slug: portfolio.slug,
          name: portfolio.name,
          riskLabel: portfolio.providerRiskLabel,
          wrapper: portfolio.wrapper,
          inceptionDate: portfolio.inceptionDate,
          isDemo: portfolio.isDemo,
        })),
      })
      return
    }

    const portfolio = await findPortfolio(db, providerSlug, portfolioSlug)
    if (!portfolio) {
      res.status(404).json({ ok: false, error: 'no such portfolio' })
      return
    }

    const [readings, portfolioFlows] = await Promise.all([
      listReadings(db, portfolio.id),
      db.select().from(flowsTable).where(eq(flowsTable.portfolioId, portfolio.id)),
    ])

    // Peers are grouped by the provider's own risk label, which is the
    // documented fallback until there is enough history for relative
    // volatility. The page says so rather than implying a common scale that
    // does not exist between firms.
    const siblings = (await listActivePortfolios(db)).filter(
      (candidate) => candidate.providerRiskLabel === portfolio.providerRiskLabel,
    )
    const peers = await Promise.all(
      siblings.map(async (sibling) => {
        const [siblingReadings, siblingFlows] = await Promise.all([
          listReadings(db, sibling.id),
          db.select().from(flowsTable).where(eq(flowsTable.portfolioId, sibling.id)),
        ])
        const series = buildSeries({
          inceptionDate: sibling.inceptionDate,
          initialPence: sibling.initialPence,
          readings: siblingReadings,
          flows: siblingFlows,
        })
        return {
          label: `${sibling.providerName} · ${sibling.name}`,
          returnFraction: timeWeightedReturn(series) ?? 0,
          isSelf: sibling.id === portfolio.id,
        }
      }),
    )

    res.status(200).json({
      ok: true,
      provider: {
        slug: portfolio.providerSlug,
        name: portfolio.providerName,
        isDemo: portfolio.isDemo,
      },
      portfolio: {
        slug: portfolio.slug,
        name: portfolio.name,
        riskLabel: portfolio.providerRiskLabel,
        styleFamily: portfolio.styleFamily,
        wrapper: portfolio.wrapper,
        inceptionDate: portfolio.inceptionDate,
        accountOpenDate: portfolio.accountOpenDate,
        initialPence: portfolio.initialPence,
        platformFeeBps: portfolio.platformFeeBps,
        feeTiersJson: portfolio.feeTiersJson,
        ocfBps: portfolio.ocfBps,
      },
      readings: readings.map((reading) => ({
        valuationDate: reading.valuationDate,
        readAt: reading.readAt,
        valuePence: reading.valuePence,
        source: reading.source,
        note: reading.note,
      })),
      flows: portfolioFlows.map((flow) => ({
        effectiveDate: flow.effectiveDate,
        amountPence: flow.amountPence,
        kind: flow.kind,
      })),
      peers,
    })
  } catch (err) {
    serverError(res, err)
  }
}
