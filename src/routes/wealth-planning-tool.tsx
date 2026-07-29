import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CASH_RATE, INVESTED_RATE, SITE_NAME, SITE_URL } from '@/config'
import { seo } from '@/lib/seo'
import { projectWealthPlan } from '@/lib/wealthPlan'
import {
  canPlan,
  toWealthPlanInput,
  toWealthPlanSearch,
  validateWealthPlanSearch,
  type WealthPlanSearch,
} from '@/lib/wealthPlanSearch'
import { percent } from '@/lib/format'
import { MaxWidthContainer } from '@/components/site/Container'
import { PageHeader, Prose } from '@/components/site/Page'
import { NavLink } from '@/components/NavLink'
import { WealthPlanForm } from '@/components/wealthPlan/WealthPlanForm'
import { WealthPlanResults } from '@/components/wealthPlan/WealthPlanResults'

/** Shown on a cold landing (no search params at all) so the page — and crawlers —
 *  see a fully worked example rather than an empty form. Illustrative only; the
 *  moment the form is submitted, real values replace it in the URL. */
const EXAMPLE: WealthPlanSearch = {
  age: 34,
  targetAge: 60,
  salary: 55_000,
  pensionPct: 5,
  pension: 60_000,
  isaStocks: 15_000,
  isaStocksMonthly: 250,
  isaCash: 5_000,
  isaCashMonthly: 100,
  cashSavings: 8_000,
  cashSavingsMonthly: 150,
  bonus: 2_000,
  bonusTarget: 'isaStocks',
}

const FAQ: { question: string; answer: string }[] = [
  {
    question: 'Why keep ISA cash and ISA stocks & shares separate?',
    answer:
      'They behave completely differently — cash is steady and lower-growth, stocks & shares are invested and grow faster on average but move around more along the way. Lumping them into one number would hide which one is actually doing the work in your forecast.',
  },
  {
    question: "What if I don't know my exact pension contribution percentage?",
    answer:
      "Check a recent payslip or your pension provider's online portal — it's usually shown as a percentage of salary. If you leave it blank, your pension is shown growing from today's value alone, with no contribution added, and that's stated plainly in the results.",
  },
  {
    question: 'Where does my bonus actually go?',
    answer:
      "Wherever you tell it to — pick one pot in the bonus section of the form. It's added once, at the end of each year, so it doesn't earn any growth in the year it lands, only from the year after.",
  },
  {
    question: 'Is this financial advice?',
    answer: `${SITE_NAME} is a modelling tool, not financial advice. It shows the consequences of your own numbers under stated assumptions — it doesn't tell you what to do, and it never compares you to anyone else.`,
  },
  {
    question: 'What growth rates are you assuming?',
    answer: `Pension and ISA stocks & shares grow at ${percent(INVESTED_RATE)} a year; ISA cash and cash savings grow at ${percent(CASH_RATE)} a year — both nominal (not inflation-adjusted), both stated openly, with sources, on the methodology page.`,
  },
]

function wealthPlanJsonLd() {
  const url = `${SITE_URL}/wealth-planning-tool`
  const publisher = { '@type': 'Organization', name: SITE_NAME, url: SITE_URL }
  const app = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `Wealth planning tool — ${SITE_NAME}`,
    description:
      'Forecast your pension, ISAs (cash and stocks & shares) and cash savings together — enter what you hold and add, including bonuses, and see where it leads, year by year.',
    url,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any (web browser)',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
    publisher,
  }
  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }
  return [app, faqPage]
}

const wealthPlanSeo = seo({
  title: `Wealth planning tool — pension, ISAs and cash, forecast together | ${SITE_NAME}`,
  description:
    'Enter your salary, pension %, ISA cash and stocks & shares, cash savings and even an expected bonus — see the whole picture carried forward, year by year, in one table.',
  path: '/wealth-planning-tool',
})

export const Route = createFileRoute('/wealth-planning-tool')({
  validateSearch: validateWealthPlanSearch,
  head: () => ({
    ...wealthPlanSeo,
    scripts: wealthPlanJsonLd().map((schema) => ({
      type: 'application/ld+json',
      children: JSON.stringify(schema),
    })),
  }),
  component: WealthPlanningToolPage,
})

function WealthPlanningToolPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const hasAnyValue = Object.values(search).some((v) => v !== undefined)
  const effective = hasAnyValue ? search : EXAMPLE
  const ready = canPlan(effective)
  const result = ready ? projectWealthPlan(toWealthPlanInput(effective)) : null

  const onSubmit = (values: WealthPlanSearch) => {
    void navigate({ to: '/wealth-planning-tool', search: toWealthPlanSearch(values) })
  }

  return (
    <>
      <PageHeader
        eyebrow="Pension · ISAs · cash, planned together"
        title="Plan your wealth: pension, ISAs and cash, forecast together"
        intro={
          <p>
            Salary, pension, an ISA split by cash and stocks &amp; shares, plain
            cash savings, even an expected bonus — enter what you actually hold and
            add, and see exactly where it leads, year by year.
          </p>
        }
      />

      <MaxWidthContainer className="py-12 lg:py-16">
        {ready && result ? (
          <>
            {!hasAnyValue ? (
              <div className="mb-6 rounded-2xl bg-muted/60 px-5 py-3.5 text-[13px] text-muted-foreground">
                This is a worked example so you can see the plan in action — change
                any number below and it becomes yours.
              </div>
            ) : null}

            <WealthPlanResults input={toWealthPlanInput(effective)} result={result} />

            <div className="mt-10 border-t border-border/60 pt-10">
              <h2 className="text-[15px] font-semibold tracking-tight">
                Adjust your numbers
              </h2>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Change anything — your plan updates. Your inputs live in the page’s
                address, so you can bookmark or share this view.
              </p>
              <div className="mt-5 max-w-2xl">
                <WealthPlanForm
                  initial={effective}
                  onSubmit={onSubmit}
                  submitLabel="Update"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-2xl">
            <h1 className="text-center text-[22px] font-semibold tracking-tight">
              Add your numbers to see your plan
            </h1>
            <p className="mt-3 text-center text-[15px] leading-relaxed text-muted-foreground">
              Your age and at least one pot or contribution are enough to begin.
              Nothing is saved or sent.
            </p>
            <div className="mt-8">
              <WealthPlanForm initial={effective} onSubmit={onSubmit} />
            </div>
          </div>
        )}
      </MaxWidthContainer>

      <MaxWidthContainer className="border-t border-border/60 py-12 lg:py-16">
        <Prose>
          <h2>Frequently asked questions</h2>
          {FAQ.map((item) => (
            <div key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </div>
          ))}

          <h2>Where this comes from</h2>
          <p>
            This tool is built and maintained by {SITE_NAME}. It uses the exact
            same growth assumptions and formulas as everywhere else on the site —
            nothing here is tuned to look more impressive than your numbers
            actually are.
          </p>
          <p>
            Every rate is stated openly, with sources, on{' '}
            <NavLink to="/methodology">our methodology page</NavLink>. You can read
            how we handle your data — nothing saved, nothing sent — on{' '}
            <NavLink to="/security">the security page</NavLink>.
          </p>
        </Prose>
      </MaxWidthContainer>
    </>
  )
}
