/**
 * One note.
 *
 * A note attached to a portfolio links back to it, because a piece of writing
 * about a fall is far more useful next to the series that fell than on its
 * own.
 */
import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { SITE_NAME } from '@/config'
import { surfaceSeo } from '@/lib/surfaceSeo'
import { MaxWidthContainer } from '@/components/site/Container'
import { NavLink } from '@/components/NavLink'
import { DemoBanner } from '@/components/tracker/DemoBanner'
import { NoteBody } from '@/components/tracker/NoteBody'

export const Route = createFileRoute('/performance/notes/$slug')({
  head: () => {
    // The title is not known until the note loads, so the head is generic.
    // Filling it in would mean fetching the note during head resolution, and
    // these pages are noindex, so a per-note title buys nothing that would
    // justify the extra request.
    const seo = surfaceSeo('performance', {
      title: `Notes — ${SITE_NAME}`,
      description: 'A note from the portfolio performance record.',
      path: '/performance/notes',
    })
    return { links: seo.links, meta: seo.meta }
  },
  component: NotePage,
})

type Note = {
  slug: string
  title: string
  publishedAt: string
  bodyMd: string
  portfolioName: string | null
  portfolioSlug: string | null
  providerName: string | null
  providerSlug: string | null
}

function NotePage() {
  const { slug } = Route.useParams()
  const [note, setNote] = useState<Note | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setNote(null)
    setError(null)
    fetch(`/api/tracker/notes?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return
        if (payload?.ok) setNote(payload.note)
        else setError(payload?.error ?? 'could not load this note')
      })
      .catch(() => !cancelled && setError('could not reach the server'))
    return () => {
      cancelled = true
    }
  }, [slug])

  return (
    <>
      <DemoBanner />
      <MaxWidthContainer className="pb-20 pt-12">
        <NavLink
          to="/performance/notes"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} strokeWidth={2.25} />
          All notes
        </NavLink>

        {error ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6">
            <p className="text-[15px] font-medium text-foreground">{error}</p>
          </div>
        ) : note === null ? (
          <p className="mt-8 text-[14px] text-muted-foreground">Loading…</p>
        ) : (
          <article className="mt-8">
            <h1 className="max-w-2xl text-[clamp(26px,4vw,34px)] font-semibold leading-[1.12] tracking-tight text-foreground">
              {note.title}
            </h1>
            <p className="mt-3 text-[13px] text-muted-foreground">
              {note.publishedAt}
              {note.portfolioName && note.providerSlug && note.portfolioSlug ? (
                <>
                  {' · '}
                  <NavLink
                    to={`/performance/p/${note.providerSlug}/${note.portfolioSlug}`}
                    className="text-foreground underline underline-offset-2"
                  >
                    {note.providerName} · {note.portfolioName}
                  </NavLink>
                </>
              ) : null}
            </p>

            <NoteBody markdown={note.bodyMd} className="mt-8" />
          </article>
        )}
      </MaxWidthContainer>
    </>
  )
}
