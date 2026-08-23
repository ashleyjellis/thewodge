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
 * GET /api/tracker/portfolio (no params) returns a summary per portfolio, for
 * the index. Summarised server-side, unlike the page above, because the index
 * has no live controls to re-derive against — one since-inception figure per
 * row, and sending a year of readings for every portfolio to compute it in
 * the browser would be a much larger payload for the same answer.
 */
import { getTrackerDb } from '../../../src/server/trackerDb/client.js'
import {
  directoryInputs,
  findPortfolio,
  listActivePortfolios,
} from '../../../src/server/trackerDb/portfolios.js'
import { summarisePortfolio } from '../../../src/lib/tracker/directory.js'
import { listReadings } from '../../../src/server/trackerDb/readings.js'
import { flows as flowsTable } from '../../../src/server/trackerDb/schema.js'
import { eq } from 'drizzle-orm'
import { buildSeries } from '../../../src/lib/tracker/series.js'
import { timeWeightedReturn } from '../../../src/lib/tracker/returns.js'
import { classifyDbFailure } from '../../../src/server/trackerDb/errors.js'
import {
  methodNotAllowed,
  type ApiRequest,
  type ApiResponse,
} from '../http.js'

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
      const inputs = await directoryInputs(db)
      res.status(200).json({
        ok: true,
        portfolios: inputs.map((input) => summarisePortfolio(input)),
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
    // Logged in full here; only the classification is returned, since the
    // underlying message can carry connection strings.
    console.error('[api/tracker/portfolio]', err)
    res.status(500).json({
      ok: false,
      error: 'the tracker database could not be read',
      reason: classifyDbFailure(err),
    })
  }
}
