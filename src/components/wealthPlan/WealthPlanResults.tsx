/**
 * Wealth planning tool results — whole-picture hero, the four-pot split,
 * growth-vs-contribution split, the bonus note, the crossover moment, and the
 * year-by-year table. Consequences, not verdicts: no comparison to anyone, no
 * "on track / behind" language anywhere — same rules as the free calculator's
 * results, applied to four named pots instead of three.
 */
import { useState } from 'react'
import type {
  ContributionOverride,
  RateOverride,
  WealthPlanInput,
  WealthPlanResult,
} from '@/lib/wealthPlan'
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
  input,
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
  input: WealthPlanInput
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
  const years = Math.max(0, result.targetAge - input.age)
  const marketLeads = result.marketAdds > result.whatYouPutIn
  const crossoverAge =
    result.crossoverYear !== null ? input.age + result.crossoverYear : null

  return (
    <div className="space-y-6">
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
          Carry on as you are and by {result.targetAge} you’ll have
        </p>
        <div className="mt-2 text-[52px] font-semibold leading-none tracking-tight tabular-nums sm:text-[68px]">
          {money(result.projectedTotal)}
        </div>
        <p className="mt-4 text-[13px] text-muted-foreground">
          {years > 0
            ? `That’s ${years} ${years === 1 ? 'year' : 'years'} of your pension, ISAs and cash savings carried forward together, in today’s terms.`
            : 'That’s your pension, ISAs and cash savings today.'}
        </p>
      </div>

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
      {input.bonus > 0 ? (
        <div className="rounded-2xl bg-accent/40 px-5 py-4">
          <p className="text-[13px] leading-relaxed text-foreground/80">
            Your expected {money(input.bonus)} annual bonus is counted as part of
            what you put in, added to your{' '}
            <span className="font-semibold text-foreground">
              {POT_LABELS[input.bonusTarget].toLowerCase()}
            </span>{' '}
            at the end of each year — change that above if it should go elsewhere.
          </p>
        </div>
      ) : null}

      {/* the crossover moment — named here, shown in full in the table below */}
      {crossoverAge !== null ? (
        <div className="rounded-2xl bg-accent/40 px-5 py-4">
          <p className="max-w-xl text-[13px] leading-relaxed text-foreground/80">
            <span className="font-semibold text-foreground">Worth pausing on:</span>{' '}
            from around age {crossoverAge}, growth on what you already hold
            typically adds more in a year than everything you put in that year —
            quietly, from then on. The table below shows exactly when.
          </p>
        </div>
      ) : null}

      {/* the year-by-year table */}
      <WealthPlanYearlyTable
        yearly={result.yearly}
        crossoverYear={result.crossoverYear}
        assumptions={result.assumptions}
        overrides={rateOverrides}
        onOverrideChange={onOverrideChange}
        onClearOverrides={onClearOverrides}
        contributionOverrides={contributionOverrides}
        onEditYear={setEditingYear}
        onClearContributionOverrides={onClearContributionOverrides}
        generation={generation}
      />

      {editingYear !== null ? (
        <ContributionModal
          age={input.age + editingYear}
          input={input}
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
          {result.pensionMonthly > 0 ? (
            <Working
              formula="Your pension contribution is your salary × the percentage you entered, every month."
              numbers={`${money(input.salary)} × ${percent(input.pensionPct)} ÷ 12 = ${money(result.pensionMonthly)}/month`}
            />
          ) : (
            <Working
              formula="No pension contribution is included in this forecast."
              numbers="add your salary and a contribution percentage above to include one"
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
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-foreground p-6 text-primary-foreground shadow-soft sm:p-7">
        <p className="max-w-md text-[14px] leading-relaxed text-primary-foreground/90">
          <span className="font-semibold text-primary-foreground">
            It’s a snapshot, not a tracked plan.
          </span>{' '}
          Come back next month and you’re retyping these same numbers — the full
          household tool keeps them updated as reality moves, tracked over time
          instead of modelled once.
        </p>
        <NavLink
          to="/app"
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-background px-5 py-3 text-[14px] font-semibold text-foreground transition-opacity hover:opacity-95"
        >
          See the full household picture →
        </NavLink>
      </div>
    </div>
  )
}
