import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { getGuide } from '@/lib/guides'
import { toSearch } from '@/lib/search'
import { MaxWidthContainer } from '@/components/site/Container'
import { PageHeader, Prose } from '@/components/site/Page'
import { NavLink } from '@/components/NavLink'

export const Route = createFileRoute('/guides/$slug')({
  head: ({ params }) => {
    const g = getGuide(params.slug)
    if (!g)
      return seo({
        title: `Guide — ${SITE_NAME}`,
        description: 'Guide',
        path: '/guides',
      })
    return seo({
      title: g.metaTitle,
      description: g.description,
      path: `/guides/${g.slug}`,
    })
  },
  component: GuidePage,
})

function GuidePage() {
  const { slug } = Route.useParams()
  const guide = getGuide(slug)

  if (!guide) {
    return (
      <MaxWidthContainer className="py-24 text-center">
        <h1 className="text-[28px] font-semibold tracking-tight">
          Guide not found
        </h1>
        <p className="mt-3 text-[15px] text-muted-foreground">
          It may have moved.{' '}
          <NavLink to="/guides" className="underline underline-offset-2">
            See all guides
          </NavLink>
          .
        </p>
      </MaxWidthContainer>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow={guide.question}
        title={guide.title}
        intro={guide.intro.map((p, i) => (
          <p key={i} className={i > 0 ? 'mt-4' : undefined}>
            {p}
          </p>
        ))}
      />

      <MaxWidthContainer className="py-12 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
          <Prose>
            {guide.blocks.map((block, i) => (
              <section key={i}>
                {block.heading ? <h2>{block.heading}</h2> : null}
                {block.body.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </section>
            ))}
          </Prose>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-3xl bg-foreground p-7 text-primary-foreground shadow-soft">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-primary-foreground/70">
                Try it with your own numbers
              </p>
              <p className="mt-3 text-[16px] leading-relaxed text-primary-foreground/90">
                We’ve filled in an example. Change anything — it’s your trajectory,
                not a comparison.
              </p>
              <NavLink
                to="/results"
                search={toSearch(guide.prefill)}
                className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-background px-6 py-3.5 text-[15px] font-semibold text-foreground transition-opacity hover:opacity-95"
              >
                {guide.ctaLabel} →
              </NavLink>
            </div>
          </aside>
        </div>
      </MaxWidthContainer>
    </>
  )
}
