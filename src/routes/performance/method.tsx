/**
 * How the tracker measures what it publishes.
 *
 * This page exists because every figure elsewhere in /performance is a claim,
 * and a claim about investment performance that does not say how it was
 * arrived at is worth very little. It is deliberately specific about the
 * choices that could otherwise flatter the numbers — the fall is published,
 * contributions are not counted as growth, gaps are not smoothed over, and
 * statistics stay hidden until there is enough of a series to support them.
 *
 * The rules described here are the ones implemented in src/lib/tracker. If
 * one ever stops being true, this page is wrong and has to change with it.
 */
import { createFileRoute } from '@tanstack/react-router'
import { DEMO_MODE, SITE_NAME } from '@/config'
import { surfaceSeo } from '@/lib/surfaceSeo'
import { THIN_SERIES_THRESHOLD } from '@/lib/tracker/providerPage'
import {
  MIN_READINGS_FOR_UNQUALIFIED,
  MIN_READINGS_FOR_VOLATILITY,
} from '@/lib/tracker/volatility'
import { MaxWidthContainer } from '@/components/site/Container'
import { PageHeader, Prose } from '@/components/site/Page'
import { NavLink } from '@/components/NavLink'
import { DemoBanner } from '@/components/tracker/DemoBanner'

export const Route = createFileRoute('/performance/method')({
  head: () => {
    const seo = surfaceSeo('performance', {
      title: `How this is measured — ${SITE_NAME}`,
      description:
        'Every rule behind the portfolio performance figures: unit pricing, time-weighted return, forward-filled gaps, drawdown, and when a statistic is withheld for want of data.',
      path: '/performance/method',
    })
    return { links: seo.links, meta: seo.meta }
  },
  component: PerformanceMethod,
})

function PerformanceMethod() {
  return (
    <>
      <DemoBanner />
      <PageHeader
        eyebrow="Performance"
        title="How this is measured"
        intro="Every figure on these pages comes from a human reading a screen and writing down what it said. Here is exactly what happens to those readings afterwards, including the parts that make the numbers look worse than they could."
      />

      <MaxWidthContainer className="py-12 lg:py-16">
        {/* Prose gives every h2 a large top margin so sections breathe. The
            first one does not need it — the page header above already
            provides the separation, and both together leave a visible hole. */}
        <Prose className="[&>h2:first-child]:mt-0">
          <h2>A reading is an observation, not a calculation</h2>
          <p>
            Once a week, someone opens each provider's app or website, looks at the account
            balance, and records it. Nothing is scraped, imported or estimated. That is slower
            and more fragile than automation, and it is the point: every number in the series
            can be traced back to a moment when a person looked at a screen.
          </p>
          <p>
            Two dates are recorded for every reading and they are not the same thing. The{' '}
            <strong>valuation date</strong> is the date the provider says the value applies to.
            The <strong>read date</strong> is when we looked. A provider still showing Friday's
            valuation on Monday morning puts three days between them, and collapsing that into
            one date would quietly misdate the whole series.
          </p>

          <h2>Contributions are not performance</h2>
          <p>
            If you pay £1,000 into an account, the balance goes up by £1,000. That is not the
            manager doing anything. The obvious way to measure growth — compare today's balance
            to what you started with — treats the two identically, which is why it is the wrong
            measure for judging a manager.
          </p>
          <p>
            Instead the account is modelled as units, the way a fund is. At inception the account
            holds one unit for every penny put in, so the opening unit price is exactly 1.000000.
            After that, <strong>the unit price only ever moves because the investments moved</strong>.
            When money is paid in, it buys units at the last known price and the price itself is
            left untouched. Growth shows up in the price; contributions show up in the unit count.
          </p>
          <p>Both figures are published on every portfolio page, because they answer different questions:</p>
          <ul>
            <li>
              <strong>Time-weighted return</strong> follows the unit price. It is how the manager
              did, independent of when money went in — and it is the figure to compare between
              providers.
            </li>
            <li>
              <strong>Simple return</strong> compares the balance to the total paid in. It is what
              actually happened to the money, including the effect of timing. It is the honest
              answer to "am I up?", and it is not a judgement on the manager.
            </li>
          </ul>
          <p>
            Where nothing has been paid in since day one, the two are identical, and the page says
            so rather than presenting two numbers as though they were independent evidence.
          </p>

          <h2>Gaps are carried forward, never smoothed over</h2>
          <p>
            Weeks get missed — holidays, outages, forgetting. When a week has no reading, the last
            known unit price is carried forward unchanged and the point is marked as
            forward-filled. It is drawn in a lighter stroke on every chart so a gap reads as a gap.
          </p>
          <p>
            What deliberately does <em>not</em> happen is interpolation. Drawing a smooth line
            between the reading before the gap and the reading after would invent a path the
            account may never have taken, and it would systematically hide any fall that happened
            inside the gap and recovered. A flat carried-forward line is visibly missing
            information. A smooth interpolated line looks like knowledge.
          </p>

          <h2>The fall is published</h2>
          <p>
            Every portfolio page shows its deepest fall from a previous high — how far down, when
            it bottomed out, and whether it has since recovered. If it has not recovered, the page
            says so and shows how far it still has to go.
          </p>
          <p>
            This is the figure most performance pages omit, and omitting it is what makes a
            steadily-rising line so misleading. Anyone deciding whether they could actually hold an
            investment needs to know what it felt like at its worst, not just where it ended up.
          </p>

          <h2>Some statistics are withheld</h2>
          <p>
            A number computed from four data points is arithmetically valid and practically
            meaningless. Rather than print one with a disclaimer beside it, the page shows nothing
            and says why — a figure that appears is remembered, and a caveat next to it is not.
          </p>
          <ul>
            <li>
              Under {THIN_SERIES_THRESHOLD} readings, no return figure is published at all — not
              on the portfolio's own page and not in the index it is listed in. The reading count
              appears in its place.
            </li>
            <li>
              Volatility needs {MIN_READINGS_FOR_VOLATILITY} readings before it appears, and is
              marked provisional until there are {MIN_READINGS_FOR_UNQUALIFIED} — roughly three
              years of weekly readings. Below the first threshold it is absent rather than zero,
              because zero is a claim and absence is the truth.
            </li>
          </ul>

          <h2>Fees are modelled, and you choose the balance</h2>
          <p>
            Platform fees are calculated rather than observed: the provider's published rate,
            compounded daily against the balance. Every portfolio page has a toggle to show the
            series before or after them, and a box to set the balance the fee tier is assessed on.
          </p>
          <p>
            That second control matters more than it looks. Most platforms charge tiered rates, so
            the same portfolio costs a different percentage at £5,000 than at £50,000 — and the
            accounts tracked here are small. Modelling the fee at <em>your</em> balance rather than
            at ours is the only way the figure means anything to you.
          </p>
          <p>
            One charge is deliberately not applied. A fund's ongoing charges figure is already
            deducted inside the unit price the provider displays, so the reading we record is
            already net of it. Subtracting it again would double-count. It is shown on the page for
            reference and never fed into the model.
          </p>

          <h2>Peer comparison is a band, never a ranking</h2>
          <p>
            Portfolios are shown against others in the same group — the average and the spread,
            not a league table. The page states which basis the grouping used, because it changes
            what the comparison means.
          </p>
          <p>
            Grouping by measured volatility puts portfolios on a common scale derived from how they
            actually behaved. Until there is enough history for that, the fallback is each
            provider's own risk label, which is <em>not</em> a common scale: a "5 out of 10" at one
            firm is not a "5 out of 10" at another, and nobody audits the mapping. Where that
            fallback is in use, the page says so rather than implying a comparability that does not
            exist.
          </p>

          <h2>What this is not</h2>
          <p>
            This is a record of what a handful of accounts did, not a recommendation and not
            advice. The sample is tiny, the period is short, and past performance tells you very
            little about future performance. Nothing here accounts for your tax position, your
            circumstances or your timescale.
          </p>
          <p>
            Providers are not paying to appear here and there are no affiliate links on these
            pages. If that ever changes it will be disclosed on this page before it changes
            anywhere else.
          </p>

          {DEMO_MODE ? (
            <>
              <h2>Right now, this is demonstration data</h2>
              <p>
                Every provider, portfolio and figure currently on these pages is fabricated. The
                firms do not exist, the accounts do not exist, and the performance was generated to
                exercise the parts of the interface that are hard to build without data — a
                portfolio that has not recovered from its fall, one with three readings, one with
                missing weeks.
              </p>
              <p>
                The arithmetic described above is the real, tested implementation. Only the numbers
                it is running on are invented. The banner at the top of every page says so, and it
                stays there until real money is invested and real readings replace them.
              </p>
            </>
          ) : null}

          <h2>Corrections</h2>
          <p>
            Readings get re-entered when a provider restates a valuation or when something was
            typed wrong. A correction replaces the reading for that date and the whole series is
            rebuilt from source, so a cached figure can never disagree with the readings behind it.
          </p>
          <p>
            If something here looks wrong, it may well be.{' '}
            <NavLink to="/about" className="text-foreground underline underline-offset-2">
              Say so
            </NavLink>{' '}
            and it will be checked against the original reading.
          </p>
        </Prose>

        <div className="mt-12">
          <NavLink
            to="/performance"
            className="inline-flex items-center rounded-full bg-foreground px-4 py-2 text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-95"
          >
            See the portfolios
          </NavLink>
        </div>
      </MaxWidthContainer>
    </>
  )
}
