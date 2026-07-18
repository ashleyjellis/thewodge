/**
 * Security — how the tool handles what you enter.
 *
 * PLACEHOLDER before launch:
 *  - swap SECURITY_CONTACT_EMAIL below for a real, monitored address
 *  - update LAST_UPDATED when this page's claims change
 *  - if/when a formal registration (e.g. ICO) exists, add it back in explicitly —
 *    nothing here should ever claim a certification we can't point to.
 * Every other claim on this page is true by construction of the app (stateless
 * calculator, no accounts, no bank connections) — keep it that way rather than
 * loosening the architecture later without updating the copy.
 */
import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { MaxWidthContainer } from '@/components/site/Container'
import { PageHeader } from '@/components/site/Page'
import { NavLink } from '@/components/NavLink'

export const Route = createFileRoute('/security')({
  head: () =>
    seo({
      title: `Security — ${SITE_NAME}`,
      description:
        'The calculator is stateless — your numbers stay in your browser and never reach a server. Here is exactly how that works.',
      path: '/security',
    }),
  component: Security,
})

const SECURITY_CONTACT_EMAIL = 'security@thewodge.co.uk' // placeholder — see file header
const LAST_UPDATED = '18 July 2026'

const BADGES = ['Nothing leaves your browser', 'No accounts, no passwords', 'No bank connections']

const PROTECTIONS = [
  {
    title: 'We don’t store your financial figures',
    body: 'Your age, pension, investments and cash live in your browser and in the page’s own address — nowhere else. There is no database row with your numbers in it, because the calculator never sends them anywhere.',
  },
  {
    title: 'We don’t require bank connections',
    body: 'No Open Banking, no linked accounts, no live balance fetched in the background. You type what you’re comfortable typing, and that’s the whole extent of it.',
  },
  {
    title: 'We don’t sell or share your data',
    body: 'The only thing we ever collect is an email address, and only if you choose to give one. It’s used to send occasional notes — never sold, never shared for advertising.',
  },
  {
    title: 'Traffic to the site is encrypted',
    body: 'Every connection to the site runs over HTTPS. There’s deliberately very little else in transit — the numbers that matter never left your device to begin with.',
  },
]

function Security() {
  return (
    <>
      <PageHeader
        eyebrow="Security"
        title="We protect your numbers mostly by not touching them"
        intro="The calculator is stateless by design. That’s a stronger promise than encryption alone — there’s simply nothing sitting on a server to protect."
      />

      <MaxWidthContainer className="pb-6">
        <div className="flex flex-wrap gap-2">
          {BADGES.map((b) => (
            <span
              key={b}
              className="rounded-full bg-accent/50 px-4 py-2 text-[13px] font-medium text-foreground"
            >
              {b}
            </span>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-muted-foreground">
          Last updated {LAST_UPDATED}.
        </p>
      </MaxWidthContainer>

      <MaxWidthContainer className="py-8 lg:py-12">
        <h2 className="text-[20px] font-semibold tracking-tight">
          How we protect what you enter
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Most security pages explain how carefully data is stored. Ours is
          simpler: the figures that matter — your pension, investments and cash —
          are never sent to us in the first place.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {PROTECTIONS.map((p) => (
            <div key={p.title} className="rounded-3xl bg-card p-7 shadow-soft">
              <h3 className="text-[16px] font-semibold tracking-tight">
                {p.title}
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
                {p.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 max-w-2xl">
          <h2 className="text-[20px] font-semibold tracking-tight">
            What we do collect
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            A newsletter email, only if you offer one, and — if enabled —
            cookieless analytics that count page views without identifying you.
            Neither ever includes anything you typed into the calculator. The full
            detail is on the{' '}
            <NavLink to="/privacy" className="underline underline-offset-2">
              privacy page
            </NavLink>
            .
          </p>
        </div>

        <div className="mt-12 max-w-2xl">
          <h2 className="text-[20px] font-semibold tracking-tight">
            Tell us if something looks wrong
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            If you spot anything that concerns you — a broken assumption, a stray
            request, anything —{' '}
            <a
              href={`mailto:${SECURITY_CONTACT_EMAIL}`}
              className="underline underline-offset-2"
            >
              {SECURITY_CONTACT_EMAIL}
            </a>{' '}
            reaches the people who built this. We read every message.
          </p>
        </div>

        <div className="mt-14 rounded-3xl bg-foreground p-8 text-primary-foreground shadow-soft sm:p-10">
          <h2 className="text-[22px] font-semibold tracking-tight sm:text-[26px]">
            Built to need less of your trust, not more.
          </h2>
          <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-primary-foreground/85">
            Nothing here is a certification — it’s an architecture. The less we
            hold, the less there is to protect.
          </p>
          <NavLink
            to="/"
            hash="calculator"
            className="mt-6 inline-flex items-center rounded-full bg-background px-5 py-3 text-[14px] font-semibold text-foreground transition-opacity hover:opacity-95"
          >
            Check your trajectory
          </NavLink>
        </div>

        <p className="mt-10 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
          {SITE_NAME} is a modelling tool, not financial advice, and is not
          authorised or supervised by the Financial Conduct Authority. See{' '}
          <NavLink to="/terms" className="underline underline-offset-2">
            terms
          </NavLink>{' '}
          for the full detail.
        </p>
      </MaxWidthContainer>
    </>
  )
}
