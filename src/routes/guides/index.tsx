import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { GUIDES } from '@/lib/guides'
import { MaxWidthContainer } from '@/components/site/Container'
import { PageHeader } from '@/components/site/Page'
import { NavLink } from '@/components/NavLink'

export const Route = createFileRoute('/guides/')({
  head: () =>
    seo({
      title: `Guides — ${SITE_NAME}`,
      description:
        'Plain answers to real money questions — each one opens the calculator with the numbers filled in.',
      path: '/guides',
    }),
  component: GuidesIndex,
})

function GuidesIndex() {
  return (
    <>
      <PageHeader
        eyebrow="Guides"
        title="Questions people actually ask"
        intro="No jargon, no league tables. Each guide opens the calculator with example numbers you can make your own."
      />
      <MaxWidthContainer className="py-12 lg:py-16">
        <div className="grid gap-6 md:grid-cols-2">
          {GUIDES.map((g) => (
            <NavLink
              key={g.slug}
              to={`/guides/${g.slug}`}
              className="group rounded-3xl bg-card p-7 shadow-soft transition-opacity hover:opacity-95"
            >
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {g.question}
              </p>
              <h2 className="mt-3 text-[20px] font-semibold leading-snug tracking-tight">
                {g.title}
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
                {g.description}
              </p>
              <span className="mt-5 inline-block text-[14px] font-medium text-foreground underline underline-offset-4">
                Read the guide →
              </span>
            </NavLink>
          ))}
        </div>
      </MaxWidthContainer>
    </>
  )
}
