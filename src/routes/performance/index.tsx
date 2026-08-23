/**
 * The portfolio index — every tracked portfolio, searchable and sortable.
 *
 * The list is filtered and sorted in the browser rather than by the server.
 * At this size that is not a shortcut: there are tens of portfolios, not
 * thousands, and typing into a box that answers on the keystroke is a
 * materially better experience than one that answers after a round trip. If
 * the list ever outgrows that, the pure functions behind it move server-side
 * unchanged.
 *
 * A portfolio too new to have a publishable return shows its reading count
 * instead of a figure. See src/lib/tracker/directory.ts for why that matters
 * more here than on the portfolio's own page.
 */
import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { SITE_NAME } from '@/config'
import { surfaceSeo } from '@/lib/surfaceSeo'
import { cn } from '@/lib/cn'
import { formatReturn } from '@/lib/tracker/money'
import {
  filterPortfolios,
  sortPortfolios,
  SORT_LABELS,
  type PortfolioSummary,
  type SortKey,
} from '@/lib/tracker/directory'
import { MaxWidthContainer } from '@/components/site/Container'
import { NavLink } from '@/components/NavLink'
import { DemoBanner } from '@/components/tracker/DemoBanner'

export const Route = createFileRoute('/performance/')({
  head: () => {
    const seo = surfaceSeo('performance', {
      title: `Portfolio performance — ${SITE_NAME}`,
      description:
        'What managed portfolios actually did with real money, week by week, with the readings shown.',
      path: '/performance',
    })
    return { links: seo.links, meta: seo.meta }
  },
  component: PerformanceIndex,
})

/**
 * One message per cause, each naming the single command that fixes it.
 * Listing every possible cause and asking the reader to work out which one
 * applies is only marginally more useful than saying nothing.
 */
const FAILURE_COPY: Record<string, { title: string; body: string }> = {
  not_migrated: {
    title: 'The tracker database has no tables yet.',
    body: 'It opened, but the schema has never been applied. Run `pnpm tracker:db:migrate`, then `pnpm tracker:seed:demo` to load the demo dataset.',
  },
  not_configured: {
    title: 'The tracker database is not configured.',
    body: 'This build is running in production mode with no TRACKER_TURSO_DATABASE_URL set. Set that and TRACKER_TURSO_AUTH_TOKEN in the deployment environment. The local-file fallback only exists for development.',
  },
  unavailable: {
    title: 'The tracker database could not be read.',
    body: 'It is configured but the query failed. Check the server logs for the underlying error — the full message is recorded there rather than shown here.',
  },
  unreachable: {
    title: 'Could not reach the server.',
    body: 'The request for portfolios did not complete. If this is local development, check that the dev server is still running.',
  },
}

const SORT_KEYS: SortKey[] = ['provider', 'return', 'running']

function Meta({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] text-muted-foreground">{children}</span>
}

function PortfolioCard({ row }: { row: PortfolioSummary }) {
  return (
    <NavLink
      to={`/performance/p/${row.providerSlug}/${row.slug}`}
      className="flex items-baseline justify-between gap-6 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-foreground/30"
    >
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-medium text-foreground">
          {row.providerName} · {row.name}
        </span>
        <span className="mt-1 block">
          <Meta>
            {[
              row.riskLabel ? `Risk ${row.riskLabel}` : null,
              row.wrapper ? row.wrapper.toUpperCase() : null,
              `${row.weeksRunning} week${row.weeksRunning === 1 ? '' : 's'}`,
              row.lastValuationDate ? `last read ${row.lastValuationDate}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Meta>
        </span>
      </span>

      <span className="shrink-0 text-right">
        {row.returnFraction === null ? (
          <>
            {/* No figure at all, rather than a figure with a caveat beside
                it. A number printed here is the thing that gets remembered. */}
            <span className="block text-[15px] tabular-nums text-muted-foreground">
              {row.readingCount} reading{row.readingCount === 1 ? '' : 's'}
            </span>
            <span className="mt-1 block text-[12px] text-muted-foreground/80">too early</span>
          </>
        ) : (
          // What the figure means is stated once above the list rather than
          // repeated on all eighteen rows, where it would read as decoration
          // and stop being read at all. "Too early" stays on the row, because
          // that one is about the row and not about the column.
          <span className="block text-[19px] tabular-nums text-foreground">
            {formatReturn(row.returnFraction)}
          </span>
        )}
      </span>
    </NavLink>
  )
}

function PerformanceIndex() {
  const [rows, setRows] = useState<PortfolioSummary[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('provider')

  useEffect(() => {
    // An empty list and a failed request are different facts and must not
    // render the same. "Nothing tracked yet" in front of a database that is
    // simply unreachable sends someone hunting for missing data rather than a
    // missing connection.
    fetch('/api/tracker/portfolio')
      .then((r) => r.json())
      .then((payload) => {
        if (payload?.ok) setRows(payload.portfolios)
        else {
          setFailure(payload?.reason ?? 'unavailable')
          setRows([])
        }
      })
      .catch(() => {
        setFailure('unreachable')
        setRows([])
      })
  }, [])

  const visible = useMemo(
    () => sortPortfolios(filterPortfolios(rows ?? [], query), sort),
    [rows, query, sort],
  )

  const total = rows?.length ?? 0
  const isSearching = query.trim().length > 0

  return (
    <>
      <DemoBanner />
      <MaxWidthContainer className="pb-20 pt-12">
        <p className="text-[12px] font-medium uppercase tracking-[0.09em] text-muted-foreground">
          Performance
        </p>
        <h1 className="mt-3 text-[clamp(28px,5vw,40px)] font-semibold leading-[1.08] tracking-tight text-foreground">
          What managed portfolios actually did
        </h1>
        <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
          Real money, in real accounts, read by hand from each provider's own screen every week.
          Nobody publishes this, so it is published here — including the falls, which is the part
          most performance pages leave out.{' '}
          <NavLink
            to="/performance/method"
            className="text-foreground underline underline-offset-2"
          >
            How this is measured
          </NavLink>
          .
        </p>

        {rows === null ? (
          <p className="mt-10 text-[14px] text-muted-foreground">Loading…</p>
        ) : failure ? (
          <div className="mt-10 rounded-2xl border border-border bg-card p-6">
            <p className="text-[15px] font-medium text-foreground">
              {FAILURE_COPY[failure]?.title ?? FAILURE_COPY.unavailable!.title}
            </p>
            <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-muted-foreground">
              {FAILURE_COPY[failure]?.body ?? FAILURE_COPY.unavailable!.body}
            </p>
          </div>
        ) : total === 0 ? (
          <div className="mt-10 rounded-2xl border border-border bg-card p-6">
            <p className="text-[15px] font-medium text-foreground">No portfolios tracked yet.</p>
            <p className="mt-2 max-w-[60ch] text-[14px] text-muted-foreground">
              The database is reachable but holds nothing. Run{' '}
              <code className="rounded bg-muted px-1.5 py-0.5">pnpm tracker:seed:demo</code> to load
              the demo dataset.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <div className="relative min-w-0 flex-1 sm:max-w-sm">
                <Search
                  size={15}
                  strokeWidth={2.25}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search provider, portfolio, risk level…"
                  aria-label="Search portfolios"
                  className="w-full rounded-full border border-border bg-card py-2.5 pl-10 pr-4 text-[14px] text-foreground placeholder:text-muted-foreground focus:border-foreground/40 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1" role="group" aria-label="Sort portfolios">
                {SORT_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={sort === key}
                    onClick={() => setSort(key)}
                    className={cn(
                      'rounded-full px-3.5 py-2 text-[13px] transition-colors',
                      sort === key
                        ? 'bg-foreground text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {SORT_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-4 text-[13px] text-muted-foreground" aria-live="polite">
              {isSearching
                ? `${visible.length} of ${total} portfolio${total === 1 ? '' : 's'}`
                : `${total} portfolio${total === 1 ? '' : 's'}`}
              {' · returns since inception, gross of platform fees'}
            </p>

            {visible.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-border bg-card p-6">
                <p className="text-[15px] font-medium text-foreground">
                  Nothing matches “{query.trim()}”.
                </p>
                <p className="mt-2 text-[14px] text-muted-foreground">
                  Search covers provider and portfolio names, risk labels, wrappers and style.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-2">
                {visible.map((row) => (
                  <PortfolioCard key={`${row.providerSlug}/${row.slug}`} row={row} />
                ))}
              </div>
            )}
          </>
        )}
      </MaxWidthContainer>
    </>
  )
}
