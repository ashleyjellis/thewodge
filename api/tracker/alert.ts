/**
 * POST /api/tracker/alert — track one portfolio by email.
 *
 * ## Why this refuses while demo mode is on
 *
 * Every provider and portfolio currently on the site is fabricated. Storing a
 * real person's email address against a fictional portfolio would collect
 * personal data for a purpose that does not exist: nothing can be sent,
 * because there is nothing to report on, and the double opt-in that would
 * make the address usable can never complete. So it is refused, with a reason
 * the form states plainly rather than a silent success that banks addresses
 * against a promise the site cannot keep.
 *
 * The storage path underneath is real and fully exercised by tests with demo
 * mode off, so switching it off is all that stands between this and working.
 */
import { getTrackerDb } from '../../src/server/trackerDb/client.js'
import { findPortfolio } from '../../src/server/trackerDb/portfolios.js'
import { looksLikeEmail, subscribeToPortfolio } from '../../src/server/trackerDb/alerts.js'
import { isDemoMode } from '../../src/server/demoMode.js'
import { classifyDbFailure } from '../../src/server/trackerDb/errors.js'
import {
  badRequest,
  methodNotAllowed,
  parseBody,
  type ApiRequest,
  type ApiResponse,
} from '../_lib/http.js'

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  try {
    if (req.method !== 'POST') {
      methodNotAllowed(res)
      return
    }

    if (isDemoMode()) {
      res.status(403).json({
        ok: false,
        reason: 'demo_mode',
        error:
          'These portfolios are fabricated demo data, so there is nothing to alert on. No address has been stored.',
      })
      return
    }

    const body = parseBody(req)
    const email = typeof body.email === 'string' ? body.email : ''
    const providerSlug = typeof body.provider === 'string' ? body.provider : ''
    const portfolioSlug = typeof body.portfolio === 'string' ? body.portfolio : ''

    if (!looksLikeEmail(email)) {
      badRequest(res, 'that does not look like an email address')
      return
    }
    if (!providerSlug || !portfolioSlug) {
      badRequest(res, 'provider and portfolio are required')
      return
    }

    const db = getTrackerDb()
    const portfolio = await findPortfolio(db, providerSlug, portfolioSlug)
    if (!portfolio) {
      res.status(404).json({ ok: false, error: 'no such portfolio' })
      return
    }

    await subscribeToPortfolio(db, email, portfolio.id)

    // The same response whether the subscription was new or already there.
    // Saying which would turn this endpoint into an oracle for whether a
    // given address is on the list, which is not something a stranger with a
    // POST request should be able to find out.
    res.status(200).json({
      ok: true,
      message: 'Check your inbox to confirm. Nothing is sent until you do.',
    })
  } catch (err) {
    console.error('[api/tracker/alert]', err)
    res.status(500).json({
      ok: false,
      error: 'could not record that',
      reason: classifyDbFailure(err),
    })
  }
}
