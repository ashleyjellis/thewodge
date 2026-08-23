/**
 * One serverless function for every /api/tracker/* endpoint.
 *
 * ## Why the endpoints share a function
 *
 * The platform makes each file under api/ its own serverless function, and
 * the Hobby plan allows twelve per deployment. Six tracker endpoints as six
 * files, alongside the household app's seven, is thirteen — one over, and the
 * build fails before anything is even compiled. Worse, it fails on a count
 * rather than on anything wrong with the code, so the next endpoint added
 * breaks a deployment that has nothing to do with it.
 *
 * A dynamic segment collapses all of them into one function while leaving the
 * public URLs exactly as they were: /api/tracker/portfolio still resolves to
 * /api/tracker/portfolio, and nothing that calls these endpoints changes. The
 * handlers themselves are untouched, moved to api/_lib/tracker/ — an
 * underscore-prefixed directory, which the platform treats as ordinary
 * imported code rather than as functions to deploy.
 *
 * The cost is one indirection and a small amount of routing that the platform
 * used to do. The benefit is six functions back, so the count is eight rather
 * than thirteen and the next few endpoints do not have to think about this
 * at all.
 *
 * Adding an endpoint: write it in api/_lib/tracker/, add it to ROUTES. Do not
 * add a new file directly under api/tracker/ — it would deploy as its own
 * function and spend one of the remaining four.
 */
import alert from '../_lib/tracker/alert.js'
import entry from '../_lib/tracker/entry.js'
import notes from '../_lib/tracker/notes.js'
import portfolio from '../_lib/tracker/portfolio.js'
import series from '../_lib/tracker/series.js'
import session from '../_lib/tracker/session.js'
import type { ApiRequest, ApiResponse } from '../_lib/http.js'

type Handler = (req: ApiRequest, res: ApiResponse) => Promise<void>

const ROUTES: Record<string, Handler> = {
  alert,
  entry,
  notes,
  portfolio,
  series,
  session,
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const raw = req.query?.resource
  const resource = Array.isArray(raw) ? raw[0] : raw

  // Object.hasOwn rather than a bare lookup: without it, a request for
  // /api/tracker/constructor would find Object.prototype.constructor and try
  // to call it as a handler.
  const route = resource && Object.hasOwn(ROUTES, resource) ? ROUTES[resource] : undefined

  if (!route) {
    res.status(404).json({ ok: false, error: 'no such endpoint' })
    return
  }

  await route(req, res)
}
