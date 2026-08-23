/**
 * The notes index — the running write-up alongside the numbers.
 *
 * A note is where something the series cannot say goes: why a portfolio was
 * opened, what a fall felt like at the time, what turned out to be wrong. The
 * figures are the record; these are the commentary, and they are kept apart
 * so neither is mistaken for the other.
 */
import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { surfaceSeo } from '@/lib/surfaceSeo'
import { MaxWidthContainer } from '@/components/site/Container'
import { NavLink } from '@/components/NavLink'
import { DemoBanner } from '@/components/tracker/DemoBanner'

export const Route = createFileRoute('/performance/notes/')({
  head: () => {
    const seo = surfaceSeo('performance', {
      title: `Notes — ${SITE_NAME}`,
      description:
        'The running write-up alongside the portfolio record: what was opened, what fell, and what turned out to be wrong.',
      path: '/performance/notes',
    })
    return { links: seo.links, meta: seo.meta }
  },
  component: NotesIndex,
})

type NoteSummary = {
  slug: string
  title: string
  publishedAt: string
  excerpt: string
  portfolioName: string | null
  portfolioSlug: string | null
  providerName: string | null
  providerSlug: string | null
}

function NotesIndex() {
  const [notes, setNotes] = useState<NoteSummary[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/tracker/notes')
      .then((r) => r.json())
      .then((payload) => {
        if (payload?.ok) setNotes(payload.notes)
        else {
          setFailed(true)
          setNotes([])
        }
      })
      .catch(() => {
        setFailed(true)
        setNotes([])
      })
  }, [])

  return (
    <>
      <DemoBanner />
      <MaxWidthContainer className="pb-20 pt-12">
        <p className="text-[12px] font-medium uppercase tracking-[0.09em] text-muted-foreground">
          Performance
        </p>
        <h1 className="mt-3 text-[clamp(28px,5vw,40px)] font-semibold leading-[1.08] tracking-tight text-foreground">
          Notes
        </h1>
        <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
          What the numbers cannot say on their own — why an account was opened, what a fall looked
          like while it was happening, and where an earlier judgement turned out to be wrong.
        </p>

        {notes === null ? (
          <p className="mt-10 text-[14px] text-muted-foreground">Loading…</p>
        ) : failed ? (
          <div className="mt-10 rounded-2xl border border-border bg-card p-6">
            <p className="text-[15px] font-medium text-foreground">Could not load the notes.</p>
            <p className="mt-2 max-w-[62ch] text-[14px] text-muted-foreground">
              The request did not complete. The underlying error is in the server logs rather than
              shown here.
            </p>
          </div>
        ) : notes.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-border bg-card p-6">
            <p className="text-[15px] font-medium text-foreground">Nothing written yet.</p>
            <p className="mt-2 max-w-[60ch] text-[14px] text-muted-foreground">
              Notes appear here as they are published. The{' '}
              <NavLink to="/performance" className="text-foreground underline underline-offset-2">
                portfolio record
              </NavLink>{' '}
              stands on its own in the meantime.
            </p>
          </div>
        ) : (
          <div className="mt-10 space-y-3">
            {notes.map((note) => (
              <NavLink
                key={note.slug}
                to={`/performance/notes/${note.slug}`}
                className="block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/30"
              >
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[16px] font-medium text-foreground">{note.title}</span>
                  <span className="text-[12px] text-muted-foreground">{note.publishedAt}</span>
                  {note.portfolioName ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {note.providerName} · {note.portfolioName}
                    </span>
                  ) : null}
                </span>
                {note.excerpt ? (
                  <span className="mt-2 block max-w-[70ch] text-[14px] leading-relaxed text-muted-foreground">
                    {note.excerpt}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </div>
        )}
      </MaxWidthContainer>
    </>
  )
}
