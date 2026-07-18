import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { MaxWidthContainer } from '@/components/site/Container'
import { PageHeader, Prose } from '@/components/site/Page'

export const Route = createFileRoute('/terms')({
  head: () =>
    seo({
      title: `Terms — ${SITE_NAME}`,
      description: `${SITE_NAME} is a modelling tool, not financial advice. Terms of use.`,
      path: '/terms',
    }),
  component: Terms,
})

function Terms() {
  return (
    <>
      <PageHeader eyebrow="Terms" title="Terms of use" />
      <MaxWidthContainer className="py-12 lg:py-16">
        <Prose>
          <h2>Not financial advice</h2>
          <p>
            {SITE_NAME} is a modelling and education tool. It shows the arithmetic
            consequences of the numbers you enter under clearly-stated assumptions.
            It does not know your circumstances, does not make recommendations, and
            is not a substitute for regulated financial advice. Decisions you make
            are your own.
          </p>
          <h2>No guarantees</h2>
          <p>
            Projections are illustrative, use simplifying assumptions, and are not
            predictions. Real investment returns vary and can be negative. We make
            no warranty that any projected figure will be achieved.
          </p>
          <h2>Use of the tool</h2>
          <p>
            The tool is provided “as is”, for personal, non-commercial use. We may
            change or withdraw it at any time. To the extent permitted by law, we
            accept no liability for decisions made on the basis of its output.
          </p>
          <p>
            This is a plain-language summary for a simple v1, not an exhaustive
            legal agreement.
          </p>
        </Prose>
      </MaxWidthContainer>
    </>
  )
}
