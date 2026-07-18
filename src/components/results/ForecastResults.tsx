/**
 * Forecast results — whole-picture hero, the pot split, growth-vs-contribution
 * split, the crossover moment, a scenario table, the full year-by-year ledger, and
 * the visible workings. Consequences, not verdicts: no comparison to anyone, no
 * "on track / behind" language anywhere.
 */
import type { ForecastInput, ForecastResult } from '@/lib/forecast'
import { INVESTED_RATE, CASH_RATE } from '@/config'
import { money, percent } from '@/lib/format'
import { cn } from '@/lib/cn'
import { StatRow } from '@/components/StatRow'
import { StackedBar } from '@/components/StackedBar'
import { HowWeWorkedThisOut, Working } from '@/components/HowWeWorkedThisOut'
import { NavLink } from '@/components/NavLink'
import { YearlyTable } from './YearlyTable'
import { StepUpCard } from './StepUpCard'

export function ForecastResults({
  input,
  result,
}: {
  input: ForecastInput
  result: ForecastResult
}) {
  const years = Math.max(0, result.targetAge - input.age)
  const marketLeads = result.marketAdds > result.whatYouPutIn
  const crossoverAge =
    result.crossoverYear !== null ? input.age + result.crossoverYear : null

  return (
    <div className="space-y-6">
      {/* a) whole-picture hero */}
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
            ? `That’s ${years} ${years === 1 ? 'year' : 'years'} of your pension, investments and cash carried forward together, in today’s terms.`
            : 'That’s your pension, investments and cash today.'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* the pot split, baked into the metrics rather than a filter */}
        <div className="rounded-3xl bg-card p-7 shadow-soft">
          <h2 className="text-[15px] font-semibold tracking-tight">
            What it’s made of
          </h2>
          <p className="mt-2 text-[13px] text-muted-foreground">
            At {result.targetAge}, kept separate — they behave differently.
          </p>
          <StackedBar
            className="mt-5"
            segments={[
              { tone: 'you', value: result.pension.future, label: 'pension' },
              { tone: 'market', value: result.stocks.future, label: 'investments' },
              { tone: 'cash', value: result.cash.future, label: 'cash' },
            ]}
          />
          <div className="mt-5 space-y-3">
            <StatRow
              tone="you"
              label="Pension"
              value={money(result.pension.future)}
              sub={`from ${money(result.pension.today)} today`}
            />
            <StatRow
              tone="market"
              label="Investments"
              value={money(result.stocks.future)}
              sub={
                result.stocks.contributions > 0
                  ? `from ${money(result.stocks.today)} + contributions`
                  : `from ${money(result.stocks.today)} today`
              }
            />
            <StatRow
              tone="cash"
              label="Cash"
              value={money(result.cash.future)}
              sub={`from ${money(result.cash.today)} today`}
            />
          </div>
        </div>

        {/* b) growth-vs-contribution split */}
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

      {/* the crossover moment — named here, shown in full in the table below */}
      {crossoverAge !== null ? (
        <div className="rounded-3xl bg-accent/40 p-7 sm:p-8">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Worth pausing on
          </p>
          <h2 className="mt-3 text-[20px] font-semibold leading-snug tracking-tight sm:text-[22px]">
            There’s a year the market starts doing more than you do.
          </h2>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-foreground/80">
            From around age {crossoverAge}, growth on what you already hold
            typically adds more in a single year than everything you put in that
            year — quietly, from then on. The table below shows exactly when.
          </p>
        </div>
      ) : null}

      {/* c) scenario table */}
      <div className="rounded-3xl bg-card p-7 shadow-soft">
        <h2 className="text-[15px] font-semibold tracking-tight">
          What changes if you change
        </h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          The same numbers, four choices — each shown at {result.targetAge}.
        </p>
        <table className="mt-5 w-full text-[14px] tabular-nums">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="pb-2 font-medium">Choice</th>
              <th className="pb-2 text-right font-medium">Monthly</th>
              <th className="pb-2 text-right font-medium">At {result.targetAge}</th>
            </tr>
          </thead>
          <tbody>
            {result.scenarios.map((s) => (
              <tr
                key={s.key}
                className={cn('border-t border-border', s.current && 'bg-accent/40')}
              >
                <td className="py-3 pr-2">
                  <span className={cn(s.current && 'font-semibold')}>{s.label}</span>
                  {s.current ? (
                    <span className="ml-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      now
                    </span>
                  ) : null}
                </td>
                <td className="py-3 text-right text-muted-foreground">
                  {s.monthly > 0 ? `${money(s.monthly)}` : '—'}
                </td>
                <td className="py-3 text-right font-semibold">{money(s.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* the full year-by-year ledger, split by pot */}
      <YearlyTable yearly={result.yearly} crossoverYear={result.crossoverYear} />

      {/* d) visible workings */}
      <div className="rounded-3xl bg-card p-7 shadow-soft">
        <HowWeWorkedThisOut>
          <Working
            formula={`Pension and stocks/shares grow at ${percent(INVESTED_RATE)} a year; cash grows at ${percent(CASH_RATE)} a year. Monthly contributions go to investments. Compounded monthly to age ${result.targetAge}.`}
            numbers={`pension ${money(result.pension.future)} + investments ${money(result.stocks.future)} + cash ${money(result.cash.future)} = ${money(result.projectedTotal)} over ${result.monthsToTarget} months`}
          />
          <Working
            formula="What you put in = starting balances + every monthly contribution. The market adds = projected total − what you put in."
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

      <StepUpCard />
    </div>
  )
}
