import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CASH_RATE, INVESTED_RATE, SITE_NAME, SITE_URL } from '@/config'
import { seo } from '@/lib/seo'
import { cn } from '@/lib/cn'
import { aggregateHousehold, type Person } from '@/lib/household'
import type { ContributionOverride, RateOverride } from '@/lib/wealthPlan'
import {
  canPlan,
  peopleToSearch,
  searchToPeople,
  toWealthPlanAssumptions,
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
    answer: `By default, pension and ISA stocks & shares grow at ${percent(INVESTED_RATE)} a year; ISA cash and cash savings grow at ${percent(CASH_RATE)} a year — both nominal (not inflation-adjusted), both stated openly, with sources, on the methodology page. Open the assumptions section of the form to use your own rates instead.`,
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
  const people = searchToPeople(effective)
  const assumptions = toWealthPlanAssumptions(effective)

  // Per-year manual rate and contribution tweaks made directly in the table —
  // deliberately not part of the URL (they're exploratory, cleared by "Clear
  // manual..." or by changing the plan itself), unlike everything else on this
  // page. Keyed by person id: each person's own table keeps its own tweaks,
  // never leaking into anyone else's.
  const [rateOverridesByPerson, setRateOverridesByPerson] = useState<Record<string, RateOverride[]>>({})
  const [contributionOverridesByPerson, setContributionOverridesByPerson] = useState<
    Record<string, ContributionOverride[]>
  >({})
  // Bumped whenever the baseline changes or overrides are cleared, so the
  // table's rate cells remount and re-seed from the new default — see
  // WealthPlanYearlyTable's docstring for why that's necessary.
  const [generation, setGeneration] = useState(0)

  // Which result the widgets below are showing — 'joint' (the household,
  // combined) or one person's own id. Local UI state, not URL-persisted:
  // switching who you're looking at isn't a change to the plan itself. Seeded
  // from whatever's true on first render only: a link shared with 2+ people
  // already in it opens on Joint, but adding a person mid-session never
  // silently switches you away from whoever you were just editing — that
  // only happens if you tap "Joint" yourself.
  const [selectedPersonId, setSelectedPersonId] = useState<string>(() =>
    people.length > 1 ? 'joint' : people[0]!.id,
  )
  const validSelectedId =
    selectedPersonId === 'joint' || people.some((p) => p.id === selectedPersonId)
      ? selectedPersonId
      : 'joint'
  const isJointView = validSelectedId === 'joint' && people.length > 1
  const activePersonId = isJointView ? null : validSelectedId === 'joint' ? people[0]!.id : validSelectedId

  // Which person's fields are open in the form's own right-hand panel —
  // 'new' for the "Add a person" tile, an id for an existing person, null for
  // nobody (just the collapsed list). A completely separate concept from
  // selectedPersonId above: that one picks whose RESULTS you're viewing,
  // this one picks whose DATA you're editing — they're allowed to differ.
  // Starts open on "You" so a first-time visitor sees the form immediately.
  const [formPersonId, setFormPersonId] = useState<string | 'new' | null>(() => people[0]!.id)
  const validFormPersonId =
    formPersonId === 'new' || formPersonId === null || people.some((p) => p.id === formPersonId)
      ? formPersonId
      : people[0]!.id

  const peopleWithOverrides = people.map((p) => ({
    ...p,
    rateOverrides: rateOverridesByPerson[p.id] ?? [],
    contributionOverrides: contributionOverridesByPerson[p.id] ?? [],
  }))
  // aggregateHousehold degenerates to a single person's own projectWealthPlan
  // result when given just the one of them — same function either way, joint
  // or individual, so the results components never need to know which.
  const activePeople = isJointView
    ? peopleWithOverrides
    : peopleWithOverrides.filter((p) => p.id === activePersonId)
  const result = ready && activePeople.length > 0 ? aggregateHousehold(activePeople, assumptions) : null

  const activeRateOverrides = activePersonId ? (rateOverridesByPerson[activePersonId] ?? []) : []
  const activeContributionOverrides = activePersonId
    ? (contributionOverridesByPerson[activePersonId] ?? [])
    : []

  // resetScroll: false on every navigate below — the router defaults to
  // jumping scroll to the top of the page, which would fight the manual
  // scroll-to-results some of these do.
  const navigateToPeople = (
    newPeople: Person[],
    options?: { investedRatePct?: number; cashRatePct?: number; scrollToResults?: boolean },
  ) => {
    setRateOverridesByPerson({})
    setContributionOverridesByPerson({})
    setGeneration((g) => g + 1)
    const result = navigate({
      to: '/wealth-planning-tool',
      search: {
        ...peopleToSearch(newPeople),
        investedRatePct: options?.investedRatePct ?? effective.investedRatePct,
        cashRatePct: options?.cashRatePct ?? effective.cashRatePct,
      },
      resetScroll: false,
    })
    if (options?.scrollToResults) {
      void result.then(() => {
        document.getElementById('plan-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } else {
      void result
    }
  }

  const onFormSavePerson = (id: string, fields: Omit<Person, 'id'>) => {
    navigateToPeople(
      people.map((p) => (p.id === id ? { ...fields, id: p.id } : p)),
      { scrollToResults: id === people[0]!.id },
    )
    setFormPersonId(null)
  }

  const onFormAddPerson = (fields: Omit<Person, 'id'>) => {
    navigateToPeople([...people, { ...fields, id: `person-${people.length + 1}` }])
    setFormPersonId(null)
  }

  const onFormRemovePerson = (id: string) => {
    navigateToPeople(people.filter((p) => p.id !== id))
    setFormPersonId(null)
  }

  const onSaveAssumptions = (investedRatePct: number | undefined, cashRatePct: number | undefined) => {
    navigateToPeople(people, { investedRatePct, cashRatePct })
  }

  const onOverrideChange = (
    year: number,
    field: 'investedRate' | 'cashRate',
    pct: number | undefined,
  ) => {
    if (!activePersonId) return
    const personId = activePersonId
    setRateOverridesByPerson((prev) => {
      const existing = (prev[personId] ?? []).find((o) => o.year === year)
      const merged: RateOverride = {
        year,
        investedRate: existing?.investedRate,
        cashRate: existing?.cashRate,
        [field]: pct,
      }
      const rest = (prev[personId] ?? []).filter((o) => o.year !== year)
      const isEmpty = merged.investedRate === undefined && merged.cashRate === undefined
      return { ...prev, [personId]: isEmpty ? rest : [...rest, merged] }
    })
  }

  const onClearOverrides = () => {
    if (!activePersonId) return
    setRateOverridesByPerson((prev) => ({ ...prev, [activePersonId]: [] }))
    setGeneration((g) => g + 1)
  }

  const onContributionSave = (
    year: number,
    values: Omit<ContributionOverride, 'year'>,
  ) => {
    if (!activePersonId) return
    const personId = activePersonId
    setContributionOverridesByPerson((prev) => ({
      ...prev,
      [personId]: [...(prev[personId] ?? []).filter((o) => o.year !== year), { year, ...values }],
    }))
  }

  const onContributionClear = (year: number) => {
    if (!activePersonId) return
    const personId = activePersonId
    setContributionOverridesByPerson((prev) => ({
      ...prev,
      [personId]: (prev[personId] ?? []).filter((o) => o.year !== year),
    }))
  }

  const onClearContributionOverrides = () => {
    if (!activePersonId) return
    setContributionOverridesByPerson((prev) => ({ ...prev, [activePersonId]: [] }))
    setGeneration((g) => g + 1)
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
        <div>
          {!hasAnyValue ? (
            <div className="mb-6 max-w-2xl rounded-2xl bg-muted/60 px-5 py-3.5 text-[13px] text-muted-foreground">
              This is a worked example so you can see the plan in action — change
              any number below and it becomes yours.
            </div>
          ) : null}
          <WealthPlanForm
            people={people}
            activePersonId={validFormPersonId}
            onSelectPerson={setFormPersonId}
            onSavePerson={onFormSavePerson}
            onAddPerson={onFormAddPerson}
            onRemovePerson={onFormRemovePerson}
            ready={ready}
            investedRatePct={effective.investedRatePct}
            cashRatePct={effective.cashRatePct}
            onSaveAssumptions={onSaveAssumptions}
          />
        </div>

        <div id="plan-results" className="mt-12 scroll-mt-20">
          {ready && result ? (
            <>
              {people.length > 1 ? (
                <PersonFilterPills
                  people={people}
                  selectedId={validSelectedId}
                  onSelect={setSelectedPersonId}
                />
              ) : null}
              <WealthPlanResults
                key={validSelectedId}
                people={activePeople}
                result={result}
                rateOverrides={activeRateOverrides}
                onOverrideChange={onOverrideChange}
                onClearOverrides={onClearOverrides}
                contributionOverrides={activeContributionOverrides}
                onContributionSave={onContributionSave}
                onContributionClear={onContributionClear}
                onClearContributionOverrides={onClearContributionOverrides}
                generation={generation}
              />
            </>
          ) : (
            <div className="max-w-xl border-t border-border/60 py-10">
              <h2 className="text-[20px] font-semibold tracking-tight">
                Add your numbers above to see your plan
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                Your age and at least one pot or contribution are enough to begin.
                Nothing is saved or sent.
              </p>
            </div>
          )}
        </div>
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
            This tool is built and maintained by {SITE_NAME}. It uses the same
            formulas as everywhere else on the site, starting from the same
            default growth assumptions — nothing here is tuned to look more
            impressive than your numbers actually are. You can override either
            rate for this forecast in the assumptions section of the form, and
            whatever you choose is stated openly next to the year-by-year table.
          </p>
          <p>
            The defaults are stated openly, with sources, on{' '}
            <NavLink to="/methodology">our methodology page</NavLink>. You can read
            how we handle your data — nothing saved, nothing sent — on{' '}
            <NavLink to="/security">the security page</NavLink>.
          </p>
        </Prose>
      </MaxWidthContainer>
    </>
  )
}

/** "Joint" plus one pill per person — only shown once there's someone besides
 *  "You" to switch between. Joint is the whole household, combined and
 *  look-only; each person's own pill is their own editable forecast. */
function PersonFilterPills({
  people,
  selectedId,
  onSelect,
}: {
  people: Person[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onSelect('joint')}
        className={cn(
          'rounded-full px-4 py-2 text-[13px] font-medium transition-colors',
          selectedId === 'joint'
            ? 'bg-foreground text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:text-foreground',
        )}
      >
        Joint
      </button>
      {people.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p.id)}
          className={cn(
            'rounded-full px-4 py-2 text-[13px] font-medium transition-colors',
            selectedId === p.id
              ? 'bg-foreground text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          {p.name}
        </button>
      ))}
    </div>
  )
}
