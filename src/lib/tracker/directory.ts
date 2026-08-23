/**
 * The portfolio index — one summary row per portfolio, plus the search and
 * sort that make a list of them navigable.
 *
 * Pure, like the rest of src/lib/tracker: rows in, rows out, no database and
 * no React. The index is the page most likely to be skim-read and least
 * likely to be read carefully, which is exactly why its restraint has to be
 * enforced here rather than left to the component.
 *
 * ## The restraint in question
 *
 * A portfolio with three readings has no return worth publishing. The
 * provider page already says so in as many words — "too early to mean
 * anything, that's the point of publishing it" — and that honesty is undone
 * completely if the index it links from prints "+14.2%" beside the same
 * portfolio in a list next to portfolios with a year of history. A reader
 * skimming a table does not check reading counts.
 *
 * So `returnFraction` is `null` below THIN_SERIES_THRESHOLD, and null is not
 * zero, not "0.00%", and not something to sort as a low number. Same rule as
 * the volatility gate: absent is a truer statement than a figure that is
 * arithmetically correct and practically meaningless.
 */
import { buildSeries } from './series.js'
import { timeWeightedReturn } from './returns.js'
import { THIN_SERIES_THRESHOLD } from './providerPage.js'
import { weeksBetween } from './dates.js'
import type { Flow, Reading } from './types.js'

/** Everything the index needs about one portfolio before it is summarised. */
export type DirectoryInput = {
  providerSlug: string
  providerName: string
  slug: string
  name: string
  riskLabel: string | null
  wrapper: string | null
  styleFamily: string | null
  inceptionDate: string
  initialPence: number
  readings: Reading[]
  flows: Flow[]
}

export type PortfolioSummary = {
  providerSlug: string
  providerName: string
  slug: string
  name: string
  riskLabel: string | null
  wrapper: string | null
  styleFamily: string | null
  inceptionDate: string
  /** observations only — the inception point is a known value, not a reading */
  readingCount: number
  weeksRunning: number
  lastValuationDate: string | null
  /**
   * Time-weighted return since inception, gross of the platform fee — or null
   * when there is too little history to publish one. Gross because the index
   * has no fee controls: the provider page models a fee against a balance the
   * reader chooses, and there is no such balance here. The page says so.
   */
  returnFraction: number | null
  isThin: boolean
}

export function summarisePortfolio(input: DirectoryInput): PortfolioSummary {
  const series = buildSeries({
    inceptionDate: input.inceptionDate,
    initialPence: input.initialPence,
    readings: input.readings,
    flows: input.flows,
  })

  const last = series[series.length - 1] ?? null
  const isThin = input.readings.length < THIN_SERIES_THRESHOLD

  return {
    providerSlug: input.providerSlug,
    providerName: input.providerName,
    slug: input.slug,
    name: input.name,
    riskLabel: input.riskLabel,
    wrapper: input.wrapper,
    styleFamily: input.styleFamily,
    inceptionDate: input.inceptionDate,
    readingCount: input.readings.length,
    weeksRunning: last ? Math.max(0, weeksBetween(input.inceptionDate, last.onDate)) : 0,
    lastValuationDate: last?.onDate ?? null,
    returnFraction: isThin ? null : timeWeightedReturn(series),
    isThin,
  }
}

// ── search ────────────────────────────────────────────────────────────────

/** The fields a query is matched against. */
function haystack(row: PortfolioSummary): string {
  return [
    row.providerName,
    row.name,
    row.riskLabel,
    row.wrapper,
    row.styleFamily,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase()
}

/**
 * Filters by a typed query.
 *
 * Every whitespace-separated token must appear somewhere in the row, but each
 * one may match a different field — so "northgate balanced" finds the
 * Northgate balanced portfolio, and "isa cautious" finds cautious portfolios
 * held in an ISA, neither of which works if the query is matched as one
 * string against one field.
 *
 * Substring rather than prefix matching, because a reader typing "growth"
 * means to find "Managed Growth" as well as "Growth 60".
 */
export function filterPortfolios(
  rows: PortfolioSummary[],
  query: string,
): PortfolioSummary[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return rows
  return rows.filter((row) => {
    const text = haystack(row)
    return tokens.every((token) => text.includes(token))
  })
}

// ── sort ──────────────────────────────────────────────────────────────────

export type SortKey = 'provider' | 'return' | 'running'

export const SORT_LABELS: Record<SortKey, string> = {
  provider: 'Provider',
  return: 'Return',
  running: 'Time running',
}

/**
 * Sorts a summarised list.
 *
 * The only non-obvious rule is in the return sort: a portfolio with no
 * published return goes to the bottom, and it does so because it has no
 * return rather than a low one. Sorting `null` as if it were zero would place
 * it among the flat performers, which reads as a claim that it went nowhere.
 *
 * The other two sorts rank by their own key and take no view on returns, so a
 * thin portfolio sorts among the rest on time or name exactly as it should —
 * one that has been open a year has been open a year, whatever its reading
 * count. Nothing about that implies a return, and the row shows its reading
 * count where a figure would otherwise be.
 */
export function sortPortfolios(rows: PortfolioSummary[], key: SortKey): PortfolioSummary[] {
  const byName = (a: PortfolioSummary, b: PortfolioSummary) =>
    a.providerName.localeCompare(b.providerName) || a.name.localeCompare(b.name)

  return [...rows].sort((a, b) => {
    if (key === 'provider') return byName(a, b)

    if (key === 'return') {
      if (a.returnFraction === null && b.returnFraction === null) return byName(a, b)
      if (a.returnFraction === null) return 1
      if (b.returnFraction === null) return -1
      return b.returnFraction - a.returnFraction || byName(a, b)
    }

    return b.weeksRunning - a.weeksRunning || byName(a, b)
  })
}
