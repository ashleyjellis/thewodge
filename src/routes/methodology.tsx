import { createFileRoute } from '@tanstack/react-router'
import { CASH_RATE, INVESTED_RATE, SITE_NAME, TARGET_AGE } from '@/config'
import { seo } from '@/lib/seo'
import { percent } from '@/lib/format'
import { MaxWidthContainer } from '@/components/site/Container'
import { PageHeader, Prose } from '@/components/site/Page'

export const Route = createFileRoute('/methodology')({
  head: () =>
    seo({
      title: `The maths — ${SITE_NAME}`,
      description: `Every assumption, stated and sourced: ${percent(INVESTED_RATE)} nominal for invested assets, ${percent(CASH_RATE)} for cash, compounded monthly to ${TARGET_AGE}.`,
      path: '/methodology',
    }),
  component: Methodology,
})

function Rate({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft">
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="mt-2 text-[40px] font-semibold leading-none tracking-tight tabular-nums">
        {value}
      </div>
      <div className="mt-2 text-[13px] text-muted-foreground">{sub}</div>
    </div>
  )
}

function Methodology() {
  return (
    <>
      <PageHeader
        eyebrow="The maths"
        title="How we worked this out"
        intro="Every number this tool shows comes from a handful of stated assumptions. They’re simplifying assumptions, not predictions — here they are in full, with where they come from."
      />

      <MaxWidthContainer className="py-12 lg:py-16">
        <div className="grid gap-5 sm:grid-cols-3">
          <Rate
            label="Invested assets"
            value={percent(INVESTED_RATE)}
            sub="pension + stocks/shares, nominal a year"
          />
          <Rate
            label="Cash savings"
            value={percent(CASH_RATE)}
            sub="deliberately lower than equities"
          />
          <Rate label="Projected to age" value={String(TARGET_AGE)} sub="compounded monthly" />
        </div>

        <div className="mt-14">
          <Prose>
            <h2>Invested assets grow at {percent(INVESTED_RATE)} a year (nominal)</h2>
            <p>
              Pension and stocks &amp; shares are treated as broadly-diversified,
              long-horizon investments and grown at {percent(INVESTED_RATE)} a year.
              Long-run global equity returns have historically sat in this region in
              nominal terms, though they vary enormously from year to year and the
              future may not resemble the past.
            </p>
            <ul>
              <li>
                <a
                  href="https://www.ubs.com/global/en/investment-bank/in-focus/2024/global-investment-returns-yearbook.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  UBS Global Investment Returns Yearbook
                </a>{' '}
                (Dimson, Marsh &amp; Staunton) — long-run global asset-class returns.
              </li>
              <li>
                Barclays Equity Gilt Study — over a century of UK equity, gilt and
                cash returns.
              </li>
            </ul>

            <h2>Cash grows at {percent(CASH_RATE)} a year — never the equity rate</h2>
            <p>
              Cash is grown at a separate, lower rate. Over the long run cash
              tracks short-term interest rates and typically returns far less than
              equities — often barely keeping pace with inflation. Blending cash
              into the equity rate would flatter the picture, so we don’t.
            </p>
            <ul>
              <li>
                <a
                  href="https://www.bankofengland.co.uk/monetary-policy/the-interest-rate-bank-rate"
                  target="_blank"
                  rel="noreferrer"
                >
                  Bank of England — Bank Rate
                </a>{' '}
                for the short-term rate cash broadly follows.
              </li>
            </ul>

            <h2>Compounding and contributions</h2>
            <p>
              Balances compound monthly. Monthly contributions are added to the
              invested pot each month and compounded to age {TARGET_AGE}. The annual
              rates above are converted to their exact monthly equivalents, so “
              {percent(INVESTED_RATE)} a year” means {percent(INVESTED_RATE)} a year.
            </p>

            <h2>These are nominal figures</h2>
            <p>
              Numbers are nominal — not adjusted for inflation. £100 at {TARGET_AGE}{' '}
              will buy less than £100 today. We show nominal figures because they’re
              the numbers you’ll actually see on a statement; just read them knowing
              inflation is working in the background.
            </p>

            <h2>What we deliberately don’t model</h2>
            <p>
              To stay honest about its limits, this tool ignores tax relief and tax
              on withdrawals, product charges, the State Pension, and the order in
              which returns arrive (sequence risk). It’s a clear-eyed sketch of a
              trajectory, not a financial plan — and it makes no comparison to
              anyone else.
            </p>
          </Prose>
        </div>
      </MaxWidthContainer>
    </>
  )
}
