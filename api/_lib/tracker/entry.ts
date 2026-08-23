/**
 * The weekly grid's data.
 *
 * GET  /api/tracker/entry  → every active portfolio with its last reading
 * POST /api/tracker/entry  { valuationDate, rows: [{ portfolioId, value, source }] }
 *      → saves them atomically and rebuilds the affected series
 *
 * Both require a signed-in operator.
 */
import { getTrackerDb } from '../../../src/server/trackerDb/client.js'
import {
  latestReadingByPortfolio,
  listActivePortfolios,
} from '../../../src/server/trackerDb/portfolios.js'
import { saveReadings, type ReadingDraft } from '../../../src/server/trackerDb/readings.js'
import type { ReadingSource } from '../../../src/server/trackerDb/schema.js'
import { ADMIN_COOKIE_NAME, readSessionToken } from '../../../src/server/adminAuth.js'
import {
  badRequest,
  methodNotAllowed,
  parseBody,
  readCookie,
  serverError,
  unauthorized,
  type ApiRequest,
  type ApiResponse,
} from '../http.js'

const SOURCES: readonly ReadingSource[] = ['web', 'app', 'statement']

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    if (!readSessionToken(readCookie(req, ADMIN_COOKIE_NAME))) {
      unauthorized(res)
      return
    }

    const db = getTrackerDb()

    if (req.method === 'GET') {
      const [portfolios, latest] = await Promise.all([
        listActivePortfolios(db),
        latestReadingByPortfolio(db),
      ])
      res.status(200).json({
        ok: true,
        portfolios: portfolios.map((portfolio) => ({
          id: portfolio.id,
          name: portfolio.name,
          providerName: portfolio.providerName,
          providerSlug: portfolio.providerSlug,
          slug: portfolio.slug,
          riskLabel: portfolio.providerRiskLabel,
          isDemo: portfolio.isDemo,
          lastValuePence: latest.get(portfolio.id)?.valuePence ?? null,
          lastValuationDate: latest.get(portfolio.id)?.valuationDate ?? null,
        })),
      })
      return
    }

    if (req.method !== 'POST') {
      methodNotAllowed(res)
      return
    }

    const body = parseBody(req)
    const defaultDate = body.valuationDate
    if (!isIsoDate(defaultDate)) {
      badRequest(res, 'valuationDate must be YYYY-MM-DD')
      return
    }
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      badRequest(res, 'rows must be a non-empty array')
      return
    }

    const drafts: ReadingDraft[] = []
    for (const raw of body.rows as Record<string, unknown>[]) {
      const portfolioId = Number(raw.portfolioId)
      const valuePence = Number(raw.valuePence)
      const valuationDate = isIsoDate(raw.valuationDate) ? raw.valuationDate : defaultDate
      const source = SOURCES.includes(raw.source as ReadingSource)
        ? (raw.source as ReadingSource)
        : 'web'

      if (!Number.isInteger(portfolioId) || portfolioId <= 0) {
        badRequest(res, 'each row needs a portfolioId')
        return
      }
      // Rejected rather than rounded: a fractional penny means the client sent
      // pounds where pence were expected, and quietly rounding it would write
      // a value a hundred times too small.
      if (!Number.isInteger(valuePence)) {
        badRequest(res, `value for portfolio ${portfolioId} must be a whole number of pence`)
        return
      }
      if (valuePence < 0) {
        badRequest(res, `value for portfolio ${portfolioId} cannot be negative`)
        return
      }

      drafts.push({
        portfolioId,
        valuationDate,
        valuePence,
        source,
        note: typeof raw.note === 'string' && raw.note.trim() !== '' ? raw.note.trim() : null,
      })
    }

    const result = await saveReadings(db, drafts)
    res.status(200).json({
      ok: true,
      saved: result.saved,
      replaced: result.replaced,
      portfoliosAffected: result.portfolioIds.length,
    })
  } catch (err) {
    serverError(res, err)
  }
}
