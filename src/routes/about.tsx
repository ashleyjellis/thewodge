import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { MaxWidthContainer } from '@/components/site/Container'
import { PageHeader, Prose } from '@/components/site/Page'

export const Route = createFileRoute('/about')({
  head: () =>
    seo({
      title: `About — ${SITE_NAME}`,
      description: `Why ${SITE_NAME} exists: a calm, whole-picture way to see where your money is heading, without verdicts or comparison.`,
      path: '/about',
    }),
  component: About,
})

function About() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title={`Why ${SITE_NAME} exists`}
        intro="Most money tools either sell you something or quietly tell you you’re failing. We wanted the opposite: a quiet instrument that just shows you where you’re heading."
      />
      <MaxWidthContainer className="py-12 lg:py-16">
        <Prose>
          <p>
            People with perfectly reasonable finances still feel a low hum of
            anxiety about money. A lot of that comes from tools built to compare you
            to an average, or to nudge you toward a product. Both make you feel
            behind.
          </p>
          <h2>Four principles</h2>
          <p>
            Every decision here is governed by four ideas, and we’d rather ship less
            than break them.
          </p>
          <ul>
            <li>
              <strong>Consequences, not verdicts.</strong> We show what happens with
              your numbers. We never judge them.
            </li>
            <li>
              <strong>The whole picture.</strong> Pension, investments and cash
              together, forecast forward — not one pot in isolation.
            </li>
            <li>
              <strong>Calm over anxiety.</strong> No comparison to averages or
              cohorts, and no live-refreshing numbers to check.
            </li>
            <li>
              <strong>Transparency.</strong> Every assumption is visible and
              sourced. If you can’t see it, we shouldn’t be using it.
            </li>
          </ul>
          <h2>What it isn’t</h2>
          <p>
            {SITE_NAME} is a modelling and education tool, not financial advice. It
            doesn’t know your full circumstances and can’t tell you what to do. For
            decisions that matter, a regulated adviser is worth their fee.
          </p>
        </Prose>
      </MaxWidthContainer>
    </>
  )
}
