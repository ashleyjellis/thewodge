/**
 * Wealth planning tool results — whole-picture hero, the crossover-year hero,
 * the four-pot split, growth-vs-contribution split, the bonus note, and the
 * year-by-year table. Consequences, not verdicts: no comparison to anyone, no
 * "on track / behind" language anywhere — same rules as the free calculator's
 * results, applied to four named pots instead of three.
 *
 * Two "save this plan" prompts (SavePlanCallout) sit inline, each earned by
 * the moment right above it — after the household figure (joint view only)
 * and after the crossover reveal — plus the existing one at the very end.
 * Deliberately not a persistent banner: each appears once, tied to something
 * the visitor just saw, never sticky or blocking.
 *
 * `people` is whichever set of people this particular result belongs to —
 * exactly one person for an individual's own view (still fully editable),
 * or the whole household for the joint view (look-only: rates and
 * contributions can only be tweaked one person at a time, so editing is
 * disabled and the bonus/pension workings switch to combined phrasing).
 */
import { useState, type ReactNode } from 'react'
import type { Person } from '@/lib/household'
import type { ContributionOverride, RateOverride, WealthPlanResult } from '@/lib/wealthPlan'
import { POT_LABELS } from '@/lib/wealthPlan'
import { money, percent } from '@/lib/format'
import { StatRow } from '@/components/StatRow'
import { StackedBar } from '@/components/StackedBar'
import { HowWeWorkedThisOut, Working } from '@/components/HowWeWorkedThisOut'
import { NavLink } from '@/components/NavLink'
import { WealthPlanYearlyTable } from './WealthPlanYearlyTable'
import { ContributionModal } from './ContributionModal'

function potSub(pot: { today: number; contributions: number }): string {
  return pot.contributions > 0
    ? `from ${money(pot.today)} + contributions`
    : `from ${money(pot.today)} today`
}

export function WealthPlanResults({
  people,
  result,
  rateOverrides,
  onOverrideChange,
  onClearOverrides,
  contributionOverrides,
  onContributionSave,
  onContributionClear,
  onClearContributionOverrides,
  generation,
}: {
  /** exactly one person = their own editable view; 2+ = the joint, read-only view */
  people: Person[]
  result: WealthPlanResult
  rateOverrides: RateOverride[]
  onOverrideChange: (year: number, field: 'investedRate' | 'cashRate', pct: number | undefined) => void
  onClearOverrides: () => void
  contributionOverrides: ContributionOverride[]
  onContributionSave: (year: number, values: Omit<ContributionOverride, 'year'>) => void
  onContributionClear: (year: number) => void
  onClearContributionOverrides: () => void
  generation: number
}) {
  const [editingYear, setEditingYear] = useState<number | null>(null)
  const editingOverride = contributionOverrides.find((o) => o.year === editingYear)
  const isJoint = people.length > 1
  const anchorAge = result.yearly[0]!.age
  const years = Math.max(0, result.targetAge - anchorAge)
  const marketLeads = result.marketAdds > result.whatYouPutIn
  const crossoverAge = result.crossoverYear !== null ? anchorAge + result.crossoverYear : null
  const totalBonus = people.reduce((s, p) => s + p.bonus, 0)

  // Ties the outlook above to the table below: jumping to a year scrolls its
  // row into view and briefly highlights it, so "the table shows exactly
  // when" is something you can click, not just read. Cleared a couple of
  // seconds later (rather than left highlighted forever) so clicking the
  // same year twice in a row highlights it again instead of doing nothing.
  const [highlightYear, setHighlightYear] = useState<number | null>(null)
  const jumpToYear = (year: number) => {
    setHighlightYear(year)
    document.getElementById(`plan-year-${year}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => setHighlightYear((cur) => (cur === year ? null : cur)), 2400)
  }

  return (
    <div className="space-y-6">
      {/* section label — pairs with "Year by year" below, marking the two
          halves of the plan: the outlook (this card + the pot/contribution
          split) and the master year-by-year table */}
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        The outlook
      </p>

      {/* whole-picture hero */}
      <div className="rounded-3xl bg-card p-7 shadow-soft sm:p-10">
        <p className="text-[13px] text-muted-foreground">
          Today you hold{' '}
          <span className="font-semibold tabular-nums text-foreground">
            {money(result.todayTotal)}
          </span>
          .
        </p>
        <p className="mt-4 text-[17px] leading-snug text-muted-foreground sm:text-[19px]">
          This is what today’s decisions are already worth, by {result.targetAge}
        </p>
        <div className="mt-2 text-[52px] font-semibold leading-none tracking-tight tabular-nums sm:text-[68px]">
          {money(result.projectedTotal)}
        </div>
        <p className="mt-4 text-[13px] text-muted-foreground">
          {years > 0
            ? `That’s ${years} ${years === 1 ? 'year' : 'years'} of your pension, ISAs and cash savings carried forward together, in today’s terms.`
            : 'That’s your pension, ISAs and cash savings today.'}
        </p>
        {years > 0 ? (
          <button
            type="button"
            onClick={() => jumpToYear(years)}
            className="mt-4 text-[12.5px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            See age {result.targetAge} in the table below ↓
          </button>
        ) : null}
      </div>

      {/* earned, not persistent: only the joint view has a household figure
          to react to, and it only ever appears here, once */}
      {isJoint ? (
        <SavePlanCallout
          message={
            <>
              <span className="font-semibold text-primary-foreground">
                This is calculated once, not kept together.
              </span>{' '}
              Add a pay rise or a new pot for either of you and these numbers are
              already behind — the full household tool keeps everyone updated,
              together, not retyped each time.
            </>
          }
          ctaLabel="Keep everyone updated →"
        />
      ) : null}

      {/* the crossover moment — its own hero, not a buried aside; jumps to
          its row in the table below.
          FLAG for Ashley, not resolved in this pass: this is personalised,
          data-derived commentary shown with no signup required — the same
          territory as the "we ask first" pillar already flagged internally
          against the FCA April 2026 targeted support regime. This round only
          changes its visual treatment (small callout -> full hero moment)
          and adds a save-plan prompt beside it; it does not change what the
          copy claims. Check the whole moment against that regulatory
          decision before extending its substance further. */}
      {crossoverAge !== null ? (
        <>
          <div className="rounded-3xl bg-card p-7 shadow-soft sm:p-10">
            <p className="text-[17px] leading-snug text-muted-foreground sm:text-[19px]">
              This is your crossover year
            </p>
            <div className="mt-2 text-[52px] font-semibold leading-none tracking-tight tabular-nums sm:text-[68px]">
              Age {crossoverAge}
            </div>
            <p className="mt-4 text-[13px] text-muted-foreground">
              From here, growth on what you already hold typically adds more in a
              year than everything you put in — quietly, from then on.
            </p>
            <button
              type="button"
              onClick={() => jumpToYear(result.crossoverYear!)}
              className="mt-4 text-[12.5px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              See it in the table below ↓
            </button>
          </div>

          <SavePlanCallout
            message={
              <>
                <span className="font-semibold text-primary-foreground">
                  This crossover year is a snapshot, not a moving target.
                </span>{' '}
                Get a raise or change a contribution and it’s already out of date —
                the full tool tracks your actual crossover year as it happens, not
                just once.
              </>
            }
            ctaLabel="Track it as it happens →"
          />
        </>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* the four-pot split */}
        <div className="rounded-3xl bg-card p-7 shadow-soft">
          <h2 className="text-[15px] font-semibold tracking-tight">
            What it’s made of
          </h2>
          <p className="mt-2 text-[13px] text-muted-foreground">
            At {result.targetAge}, kept separate — they behave differently.
          </p>
          {/* the bar groups the two cash-like pots into one segment — 'muted' reads as
              invisible against the track itself, so the fourth colour only appears
              below, where each dot sits on a plain card background instead */}
          <StackedBar
            className="mt-5"
            segments={[
              { tone: 'you', value: result.pots.pension.future, label: 'pension' },
              {
                tone: 'market',
                value: result.pots.isaStocks.future,
                label: 'ISA stocks & shares',
              },
              {
                tone: 'cash',
                value: result.pots.isaCash.future + result.pots.cashSavings.future,
                label: 'ISA cash + cash savings',
              },
            ]}
          />
          <div className="mt-5 space-y-3">
            <StatRow
              tone="you"
              label="Pension"
              value={money(result.pots.pension.future)}
              sub={potSub(result.pots.pension)}
            />
            <StatRow
              tone="market"
              label="ISA — stocks & shares"
              value={money(result.pots.isaStocks.future)}
              sub={potSub(result.pots.isaStocks)}
            />
            <StatRow
              tone="cash"
              label="ISA — cash"
              value={money(result.pots.isaCash.future)}
              sub={potSub(result.pots.isaCash)}
            />
            <StatRow
              tone="muted"
              label="Cash savings"
              value={money(result.pots.cashSavings.future)}
              sub={potSub(result.pots.cashSavings)}
            />
          </div>
        </div>

        {/* growth-vs-contribution split */}
        <div className="rounded-3xl bg-card p-7 shadow-soft">
          <h2 className="text-[15px] font-semibold tracking-tight">
            Where it comes from
          </h2>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Across everything, combined.
          </p>
          <StackedBar
            className="mt-5"
            segments={[
              { tone: 'you', value: result.whatYouPutIn, label: 'what you put in' },
              { tone: 'market', value: result.marketAdds, label: 'the market adds' },
            ]}
          />
          <div className="mt-5 space-y-3">
            <StatRow
              tone="you"
              label="What you put in"
              value={money(result.whatYouPutIn)}
            />
            <StatRow
              tone="market"
              label="The market adds"
              value={money(result.marketAdds)}
            />
          </div>
          {marketLeads ? (
            <p className="mt-5 text-[14px] italic leading-relaxed text-muted-foreground">
              Most of the heavy lifting isn’t yours to do.
            </p>
          ) : null}
        </div>
      </div>

      {/* transparency on where the bonus goes — a real modelling choice, never silent */}
      {!isJoint && people[0]!.bonus > 0 ? (
        <div className="rounded-2xl bg-accent/40 px-5 py-4">
          <p className="text-[13px] leading-relaxed text-foreground/80">
            Your expected {money(people[0]!.bonus)} annual bonus is counted as
            part of what you put in, added to your{' '}
            <span className="font-semibold text-foreground">
              {POT_LABELS[people[0]!.bonusTarget].toLowerCase()}
            </span>{' '}
            at the end of each year — change that above if it should go elsewhere.
          </p>
        </div>
      ) : null}
      {isJoint && totalBonus > 0 ? (
        <div className="rounded-2xl bg-accent/40 px-5 py-4">
          <p className="text-[13px] leading-relaxed text-foreground/80">
            Between everyone, an expected{' '}
            <span className="font-semibold text-foreground">{money(totalBonus)}</span>{' '}
            in annual bonuses is counted as part of what's put in each year —
            switch to someone's own name above to see exactly where theirs goes.
          </p>
        </div>
      ) : null}

      {/* the year-by-year table */}
      <WealthPlanYearlyTable
        yearly={result.yearly}
        crossoverYear={result.crossoverYear}
        highlightYear={highlightYear}
        assumptions={result.assumptions}
        overrides={rateOverrides}
        onOverrideChange={onOverrideChange}
        onClearOverrides={onClearOverrides}
        contributionOverrides={contributionOverrides}
        onEditYear={setEditingYear}
        onClearContributionOverrides={onClearContributionOverrides}
        generation={generation}
        editable={!isJoint}
      />

      {editingYear !== null && !isJoint ? (
        <ContributionModal
          age={people[0]!.age + editingYear}
          input={people[0]!}
          override={editingOverride}
          onSave={(values) => onContributionSave(editingYear, values)}
          onClear={() => onContributionClear(editingYear)}
          onClose={() => setEditingYear(null)}
        />
      ) : null}

      {/* visible workings */}
      <div className="rounded-3xl bg-card p-7 shadow-soft">
        <HowWeWorkedThisOut>
          <Working
            formula={`Pension and ISA stocks & shares grow at ${percent(result.assumptions.investedRate)} a year; ISA cash and cash savings grow at ${percent(result.assumptions.cashRate)} a year — both set in the assumptions section above. Compounded monthly to age ${result.targetAge}.`}
            numbers={`pension ${money(result.pots.pension.future)} + ISA stocks & shares ${money(result.pots.isaStocks.future)} + ISA cash ${money(result.pots.isaCash.future)} + cash savings ${money(result.pots.cashSavings.future)} = ${money(result.projectedTotal)}`}
          />
          {!isJoint && result.pensionMonthly > 0 ? (
            <Working
              formula="Your pension contribution is your salary × the percentage you entered, every month."
              numbers={`${money(people[0]!.salary)} × ${percent(people[0]!.pensionPct)} ÷ 12 = ${money(result.pensionMonthly)}/month`}
            />
          ) : !isJoint ? (
            <Working
              formula="No pension contribution is included in this forecast."
              numbers="add your salary and a contribution percentage above to include one"
            />
          ) : result.pensionMonthly > 0 ? (
            <Working
              formula="Each person's pension contribution is their own salary × their own percentage, every month — summed here."
              numbers={`${money(result.pensionMonthly)}/month combined`}
            />
          ) : (
            <Working
              formula="No pension contribution is included in this forecast."
              numbers="add a salary and a contribution percentage for at least one person to include one"
            />
          )}
          <Working
            formula="What you put in = starting balances + every monthly contribution + every bonus. The market adds = projected total − what you put in."
            numbers={`${money(result.whatYouPutIn)} put in · ${money(result.marketAdds)} from growth`}
          />
          <p>
            Nominal figures — not adjusted for inflation. Every rate and its source
            is on the{' '}
            <NavLink to="/methodology" className="underline underline-offset-2">
              methodology page
            </NavLink>
            . Change nothing here you can’t see.
          </p>
        </HowWeWorkedThisOut>
      </div>

      {/* the permission line — closes on perspective, not on "save more" */}
      <p className="px-1 text-[15px] italic leading-relaxed text-muted-foreground">
        However this looks today, it’s already further than it feels — most of what
        happens from here isn’t down to you.
      </p>

      {/* the honest step-up — this is a one-off forecast, not a tracked plan */}
      <SavePlanCallout
        message={
          <>
            <span className="font-semibold text-primary-foreground">
              It’s a snapshot, not a tracked plan.
            </span>{' '}
            Come back next month and you’re retyping these same numbers — the full
            household tool keeps them updated as reality moves, tracked over time
            instead of modelled once.
          </>
        }
        ctaLabel="See the full household picture →"
      />
    </div>
  )
}

/** The one signup prompt shape used everywhere on this page — plain,
 *  first-person, states the free version's limitation and what an account
 *  adds, no urgency tricks. Always inline, never a blocking modal or a
 *  fixed/sticky banner: each instance is placed once, earned by whatever
 *  the visitor just saw immediately above it. */
function SavePlanCallout({ message, ctaLabel }: { message: ReactNode; ctaLabel: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-foreground p-6 text-primary-foreground shadow-soft sm:p-7">
      <p className="max-w-md text-[14px] leading-relaxed text-primary-foreground/90">{message}</p>
      <NavLink
        to="/app"
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-background px-5 py-3 text-[14px] font-semibold text-foreground transition-opacity hover:opacity-95"
      >
        {ctaLabel}
      </NavLink>
    </div>
  )
}
