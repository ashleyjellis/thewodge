/**
 * SEO metadata for a route belonging to a product surface.
 *
 * Wraps seo() and adds the noindex robots meta whenever the surface it
 * belongs to is not indexable. Nine routes previously each hand-wrote
 * `{ name: 'robots', content: 'noindex' }` into their own head(); the risk
 * with that is not the repetition but that a tenth route quietly forgets,
 * and nothing catches it. Surfaces are declared once in src/surfaces.json and
 * every route in one inherits its indexability.
 *
 * Worth being clear about what this does and does not protect. A noindex meta
 * is applied by the router on the client, so a crawler that fetches one of
 * these URLs without running JavaScript receives the SPA shell and never sees
 * it. The real protection for a hidden surface is the Disallow rule that
 * scripts/seo.mjs writes into robots.txt from the same list. This meta is the
 * second line, for crawlers that do execute JavaScript and for anything that
 * reaches the page by another route.
 */
import { getSurface, type SurfaceId } from '@/config'
import { seo, type Seo } from './seo'

export function surfaceSeo(surfaceId: SurfaceId, options: Seo) {
  const base = seo(options)
  const surface = getSurface(surfaceId)
  if (surface?.indexable !== false) return base

  return {
    ...base,
    meta: [...base.meta, { name: 'robots', content: 'noindex' }],
  }
}
