import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME, TARGET_AGE } from '@/config'
import { seo } from '@/lib/seo'
import { MaxWidthContainer } from '@/components/site/Container'
import { PageHeader } from '@/components/site/Page'
import { NavLink } from '@/components/NavLink'

export const Route = createFileRoute('/how-it-works')({
  head: () =>
    seo({
      title: `How it works — ${SITE_NAME}`,
      description: `Three steps: enter your pots, see the forecast to ${TARGET_AGE}, and understand the split between what you put in and what the market adds.`,
      path: '/how-it-works',
    }),
  component: HowItWorks,
})

const STEPS = [
  {
    n: '1',
    title: 'Enter your pots, kept separate',
    body: 'Pension, stocks & shares, and cash go in as three separate numbers, plus what you add each month. They’re kept apart because they behave differently — cash doesn’t grow like equities, and pretending it does would flatter the picture.',
  },
  {
    n: '2',
    title: 'See the whole picture, carried forward',
    body: `Everything is projected together to ${TARGET_AGE}. You get today’s total and where simply carrying on takes you — one calm number, not a scoreboard.`,
  },
  {
    n: '3',
    title: 'Understand where it comes from',
    body: 'The forecast splits into what you put in and what the market adds on top. Over a long enough horizon, the market usually does most of the work — which is the quietly reassuring part.',
  },
]

function HowItWorks() {
  return (
    <>
      <PageHeader
        eyebrow="How it works"
        title="Three steps, no verdicts"
        intro="It shows the consequences of your own numbers under stated assumptions. It never tells you you’re behind, and it never compares you to anyone."
      />
      <MaxWidthContainer className="py-12 lg:py-16">
        <div className="grid gap-6 lg:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-3xl bg-card p-7 shadow-soft">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/60 text-[14px] font-semibold tabular-nums">
                {s.n}
              </div>
              <h2 className="mt-4 text-[17px] font-semibold tracking-tight">
                {s.title}
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-3xl bg-card p-8 shadow-soft">
          <h2 className="text-[18px] font-semibold tracking-tight">
            What it never does
          </h2>
          <ul className="mt-4 grid gap-3 text-[15px] text-muted-foreground sm:grid-cols-2">
            <li>No comparison to averages, medians or “typical for your age”.</li>
            <li>No “on track” or “behind” — those are verdicts, not maths.</li>
            <li>No live-refreshing numbers to anxiously check.</li>
            <li>No hidden assumptions — every rate is on the maths page.</li>
          </ul>
          <div className="mt-6">
            <NavLink
              to="/"
              hash="calculator"
              className="inline-flex items-center rounded-full bg-foreground px-5 py-3 text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-95"
            >
              Check your trajectory
            </NavLink>
          </div>
        </div>
      </MaxWidthContainer>
    </>
  )
}
