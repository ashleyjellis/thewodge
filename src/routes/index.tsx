import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SITE_NAME, TARGET_AGE } from '@/config'
import { seo } from '@/lib/seo'
import {
  validateCalculatorSearch,
  toSearch,
  type CalculatorSearch,
} from '@/lib/search'
import { MaxWidthContainer } from '@/components/site/Container'
import { Calculator } from '@/components/calculator/Calculator'
import { NavLink } from '@/components/NavLink'

export const Route = createFileRoute('/')({
  validateSearch: validateCalculatorSearch,
  head: () =>
    seo({
      title: `${SITE_NAME} — see your whole financial picture`,
      description: `Pension, investments and cash, carried forward to ${TARGET_AGE}. Consequences, not verdicts — and no comparison to anyone else.`,
      path: '/',
    }),
  component: Home,
})

function Home() {
  const navigate = useNavigate()
  const search = Route.useSearch()

  const onSubmit = (values: CalculatorSearch) => {
    void navigate({ to: '/results', search: toSearch(values) })
  }

  return (
    <>
      {/* Hero — the tool is the hero */}
      <section className="border-b border-border/60 bg-background pt-14 lg:pt-20">
        <MaxWidthContainer>
          <div className="grid items-start gap-10 pb-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24">
            <div className="max-w-xl">
              <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Pension · investments · cash, together
              </p>
              <h1 className="mt-4 text-[38px] font-semibold leading-[1.05] tracking-tight sm:text-[52px]">
                See where your money is actually heading.
              </h1>
              <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted-foreground">
                Enter what you hold and what you add each month. {SITE_NAME}{' '}
                carries it forward to {TARGET_AGE} and shows the consequences — the
                whole picture, no comparison to anyone, no verdicts.
              </p>
              <p className="mt-6 text-[13px] text-muted-foreground">
                A modelling tool, not advice. Nothing saved, nothing sent.
              </p>
            </div>

            <div id="calculator" className="scroll-mt-24">
              <Calculator initial={search} onSubmit={onSubmit} />
            </div>
          </div>
        </MaxWidthContainer>
      </section>

      {/* How it works — teaser */}
      <section className="py-16 lg:py-20">
        <MaxWidthContainer>
          <SectionLabel>How it works</SectionLabel>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <Step n="1" title="Enter your pots">
              Pension, stocks &amp; shares, and cash — kept separate, because they
              behave differently.
            </Step>
            <Step n="2" title="See the whole picture">
              One forecast to {TARGET_AGE}: today’s total, and where carrying on
              takes you.
            </Step>
            <Step n="3" title="Understand the split">
              How much is what you put in, and how much the market adds on top.
            </Step>
          </div>
          <div className="mt-8">
            <NavLink
              to="/how-it-works"
              className="text-[14px] font-medium text-foreground underline underline-offset-4"
            >
              Read how it works →
            </NavLink>
          </div>
        </MaxWidthContainer>
      </section>

      {/* Principles */}
      <section className="border-t border-border/60 py-16 lg:py-20">
        <MaxWidthContainer>
          <SectionLabel>What this is, and isn’t</SectionLabel>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Principle title="Consequences, not verdicts">
              It shows what happens with your numbers. It never tells you you’re
              behind, or on track.
            </Principle>
            <Principle title="The whole picture">
              Pension, investments and cash forecast together — not one pot in
              isolation.
            </Principle>
            <Principle title="Calm, not anxiety">
              No averages, no cohorts, no live-refreshing numbers to check.
            </Principle>
            <Principle title="Every assumption shown">
              The rates are on the page and sourced. Change nothing you can’t see.
            </Principle>
          </div>
        </MaxWidthContainer>
      </section>

      {/* Guides teaser */}
      <section className="border-t border-border/60 py-16 lg:py-20">
        <MaxWidthContainer>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionLabel>Guides</SectionLabel>
              <p className="mt-3 max-w-md text-[16px] leading-relaxed text-muted-foreground">
                Plain answers to the questions people actually ask — each one opens
                the calculator with the numbers filled in.
              </p>
            </div>
            <NavLink
              to="/guides"
              className="text-[14px] font-medium text-foreground underline underline-offset-4"
            >
              All guides →
            </NavLink>
          </div>
        </MaxWidthContainer>
      </section>
    </>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </p>
  )
}

function Step({
  n,
  title,
  children,
}: {
  n: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-3xl bg-card p-7 shadow-soft">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/60 text-[14px] font-semibold tabular-nums">
        {n}
      </div>
      <h3 className="mt-4 text-[16px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  )
}

function Principle({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  )
}
