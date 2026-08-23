/**
 * Site-wide configuration. The name lives here as a single constant so it is
 * trivial to change. Forecast assumptions live here too — they are stated openly
 * on /methodology (principle 4: transparency).
 */

/** Working name. Change here to rename everywhere. */
export const SITE_NAME = 'The Wodge'

export const SITE_TAGLINE = 'See your whole financial picture, forecast forward.'

/**
 * Canonical origin, used for absolute URLs (OG tags, sitemap, canonical links).
 * Override at build with VITE_SITE_URL.
 */
export const SITE_URL = (
  import.meta.env?.VITE_SITE_URL ?? 'https://thewodge.co.uk'
).replace(/\/$/, '')

// ── Forecast assumptions (nominal, stated on /methodology) ───────────────────

/** Nominal annual growth for invested assets (pension + stocks/shares). */
export const INVESTED_RATE = 0.07
/** Nominal annual growth for cash savings — deliberately lower than equities. */
export const CASH_RATE = 0.045
/** Age the forecast projects to. */
export const TARGET_AGE = 60

/**
 * The down-years band's stress magnitude (planBand.ts/downYears.ts): a
 * named, openly-stated constant for v1 rather than a per-household editable
 * assumption — the household chooses HOW MANY down years to stress-test
 * for (households.downYearsCount), not how severe each one is. Roughly a
 * "genuinely bad year" for equities (2008 was worse, 2022 was milder) —
 * illustrative, not a historical model. Flagged as a fast-follow to make
 * this editable too. Applies to pension + investments only, never cash
 * (matches the "down-market" framing).
 */
export const DOWN_YEAR_RATE = -0.2

/**
 * Default assumed pension contribution split, used ONLY when someone gives an
 * income but no monthly pension contribution — a common employer-match shape, not
 * a recommendation. Always surfaced explicitly wherever it's applied; never silent.
 */
export const DEFAULT_EMPLOYER_PENSION_PCT = 0.06
export const DEFAULT_PERSONAL_PENSION_PCT = 0.06

/** Layout: the site max width. Desktop uses the horizontal space; the narrow
 *  single column only appears at mobile widths. */
export const MAX_WIDTH = 1180

// ── Analytics (privacy-friendly, Plausible-style) ────────────────────────────

/** Plausible domain (data-domain). Set VITE_ANALYTICS_DOMAIN to enable. */
export const ANALYTICS_DOMAIN = import.meta.env?.VITE_ANALYTICS_DOMAIN ?? ''
/** Self-hostable Plausible script src; defaults to the hosted script. */
export const ANALYTICS_SRC =
  import.meta.env?.VITE_ANALYTICS_SRC ?? 'https://plausible.io/js/script.js'

// ── Surfaces (experiments and product areas) ─────────────────────────────────
//
// The site carries several parallel product experiments at once, and the
// intention is to try directions and ship one. `src/surfaces.json` is the
// single list that decides, for each of them, whether it appears in
// navigation and whether search engines may index it. Three things read that
// list — this module, the nav in SiteHeader, and robots.txt generation in
// scripts/seo.mjs — so those three can never drift apart. JSON rather than a
// .ts module specifically so the Node build scripts can read the same file
// the app does.
//
// "Hidden" means hidden, not gone: a hidden surface disappears from
// navigation, the sitemap and search, but its URLs still resolve, so a link
// can be shared or a surface checked in production. That is a deliberate
// choice, and it is why robots.txt carrying an explicit rule per surface is
// the real protection here rather than a belt-and-braces extra.

import surfacesJson from './surfaces.json'

export type SurfaceId = 'app' | 'app2' | 'archive' | 'performance'

export type SurfaceNavItem = { to: string; label: string }

export type Surface = {
  id: SurfaceId
  label: string
  /** URL prefix owned by this surface — also what robots.txt disallows */
  basePath: string
  /** appears in site navigation */
  visible: boolean
  /** may be indexed; false adds a noindex meta and a robots.txt Disallow */
  indexable: boolean
  /** dropdown entries; a visible surface with none renders no menu */
  nav: SurfaceNavItem[]
}

/**
 * Per-surface visibility overrides, so a surface can be turned on or off for
 * one environment without a code change: VITE_SURFACE_OVERRIDES="app2=on,archive=off".
 *
 * One variable holding both directions rather than separate allow and deny
 * lists — with two lists there is always a question of which one wins when a
 * surface appears in both, and no answer to it that anyone remembers.
 */
function parseOverrides(raw: string): Partial<Record<SurfaceId, boolean>> {
  const overrides: Partial<Record<SurfaceId, boolean>> = {}
  for (const pair of raw.split(',')) {
    const [id, state] = pair.split('=').map((s) => s.trim())
    if (!id || !state) continue
    overrides[id as SurfaceId] = state === 'on' || state === 'true' || state === '1'
  }
  return overrides
}

const SURFACE_OVERRIDES = parseOverrides(import.meta.env?.VITE_SURFACE_OVERRIDES ?? '')

export const SURFACES: Surface[] = (surfacesJson.surfaces as Surface[]).map((surface) => ({
  ...surface,
  visible: SURFACE_OVERRIDES[surface.id] ?? surface.visible,
}))

export function getSurface(id: SurfaceId): Surface | undefined {
  return SURFACES.find((s) => s.id === id)
}

export function isSurfaceVisible(id: SurfaceId): boolean {
  return getSurface(id)?.visible ?? false
}

/** Surfaces that belong in navigation — visible, and with somewhere to go. */
export function navigableSurfaces(): Surface[] {
  return SURFACES.filter((s) => s.visible && s.nav.length > 0)
}
