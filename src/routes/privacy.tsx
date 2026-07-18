import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { MaxWidthContainer } from '@/components/site/Container'
import { PageHeader, Prose } from '@/components/site/Page'

export const Route = createFileRoute('/privacy')({
  head: () =>
    seo({
      title: `Privacy — ${SITE_NAME}`,
      description: `How ${SITE_NAME} handles data: your financial figures stay in the page, never sent to us.`,
      path: '/privacy',
    }),
  component: Privacy,
})

function Privacy() {
  return (
    <>
      <PageHeader eyebrow="Privacy" title="Privacy" />
      <MaxWidthContainer className="py-12 lg:py-16">
        <Prose>
          <p>
            The calculator is stateless. The figures you enter — age, pension,
            investments, cash and contributions — live only in your browser and in
            the page’s address bar so you can bookmark or share a view. They are
            never sent to us, and there is no account to create.
          </p>
          <h2>What we do collect</h2>
          <ul>
            <li>
              <strong>Newsletter email</strong>, only if you choose to enter it.
              We use it to send occasional notes and nothing else.
            </li>
            <li>
              <strong>Privacy-friendly analytics.</strong> If enabled, we use a
              cookieless analytics tool that counts page views without tracking
              individuals or collecting personal data. Your financial inputs are
              never part of any analytics event.
            </li>
          </ul>
          <h2>What we don’t do</h2>
          <ul>
            <li>No advertising trackers or third-party profiling.</li>
            <li>No selling or sharing of data.</li>
            <li>No storing of your financial figures on our servers.</li>
          </ul>
          <p>
            This is a summary for a simple v1, not a full legal policy. If you have
            a question about your data, get in touch.
          </p>
        </Prose>
      </MaxWidthContainer>
    </>
  )
}
