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
