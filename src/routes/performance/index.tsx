/**
 * The portfolio index. Deliberately plain for now — search and the method
 * page land with T6; this exists so the Performance menu has somewhere real
 * to go rather than pointing at a page that does not yet render.
 */
import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { surfaceSeo } from '@/lib/surfaceSeo'
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

type Row = {
  providerSlug: string
  providerName: string
  slug: string
  name: string
  riskLabel: string | null
  inceptionDate: string
}

function PerformanceIndex() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)

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
          setFailed(true)
          setRows([])
        }
      })
      .catch(() => {
        setFailed(true)
        setRows([])
      })
  }, [])

  const byProvider = (rows ?? []).reduce<Record<string, Row[]>>((acc, row) => {
    ;(acc[row.providerName] ??= []).push(row)
    return acc
  }, {})

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
          most performance pages leave out.
        </p>

        {rows === null ? (
          <p className="mt-10 text-[14px] text-muted-foreground">Loading…</p>
        ) : failed ? (
          <div className="mt-10 rounded-2xl border border-border bg-card p-6">
            <p className="text-[15px] font-medium text-foreground">
              Could not reach the tracker database.
            </p>
            <p className="mt-2 max-w-[60ch] text-[14px] text-muted-foreground">
              This is a configuration problem rather than an empty record. Locally, run{' '}
              <code className="rounded bg-muted px-1.5 py-0.5">pnpm tracker:db:migrate</code> then{' '}
              <code className="rounded bg-muted px-1.5 py-0.5">pnpm tracker:seed:demo</code>. In a
              deployed environment, check that TRACKER_TURSO_DATABASE_URL and
              TRACKER_TURSO_AUTH_TOKEN are set.
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-border bg-card p-6">
            <p className="text-[15px] font-medium text-foreground">No portfolios tracked yet.</p>
            <p className="mt-2 max-w-[60ch] text-[14px] text-muted-foreground">
              The database is reachable but holds nothing. Run{' '}
              <code className="rounded bg-muted px-1.5 py-0.5">pnpm tracker:seed:demo</code> to load
              the demo dataset.
            </p>
          </div>
        ) : (
          <div className="mt-10 space-y-8">
            {Object.entries(byProvider).map(([providerName, portfolios]) => (
              <div key={providerName}>
                <h2 className="text-[16px] font-semibold text-foreground">{providerName}</h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {portfolios.map((portfolio) => (
                    <NavLink
                      key={`${portfolio.providerSlug}/${portfolio.slug}`}
                      to={`/performance/p/${portfolio.providerSlug}/${portfolio.slug}`}
                      className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/30"
                    >
                      <span className="block text-[14px] font-medium text-foreground">
                        {portfolio.name}
                      </span>
                      <span className="mt-1 block text-[13px] text-muted-foreground">
                        Risk {portfolio.riskLabel ?? '—'} · since {portfolio.inceptionDate}
                      </span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </MaxWidthContainer>
    </>
  )
}
