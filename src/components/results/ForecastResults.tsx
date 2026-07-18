/**
 * Forecast results — whole-picture hero, growth-vs-contribution split, scenario
 * table, and the visible workings. Consequences, not verdicts: no comparison to
 * anyone, no "on track / behind" language anywhere.
 */
import type { ForecastInput, ForecastResult } from '@/lib/forecast'
import { INVESTED_RATE, CASH_RATE } from '@/config'
import { money, percent } from '@/lib/format'
import { cn } from '@/lib/cn'
import { StatRow } from '@/components/StatRow'
import { StackedBar } from '@/components/StackedBar'
import { HowWeWorkedThisOut, Working } from '@/components/HowWeWorkedThisOut'
import { NavLink } from '@/components/NavLink'

export function ForecastResults({
  input,
  result,
}: {
  input: ForecastInput
  result: ForecastResult
}) {
  const years = Math.max(0, result.targetAge - input.age)
  const marketLeads = result.marketAdds > result.whatYouPutIn

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
        {/* b) growth-vs-contribution split */}
        <div className="rounded-3xl bg-card p-7 shadow-soft">
          <h2 className="text-[15px] font-semibold tracking-tight">
            Where it comes from
          </h2>
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
                  className={cn(
                    'border-t border-border',
                    s.current && 'bg-accent/40',
                  )}
                >
                  <td className="py-3 pr-2">
                    <span className={cn(s.current && 'font-semibold')}>
                      {s.label}
                    </span>
                    {s.current ? (
                      <span className="ml-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        now
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 text-right text-muted-foreground">
                    {s.monthly > 0 ? `${money(s.monthly)}` : '—'}
                  </td>
                  <td className="py-3 text-right font-semibold">
                    {money(s.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* d) visible workings */}
      <div className="rounded-3xl bg-card p-7 shadow-soft">
        <HowWeWorkedThisOut>
          <Working
            formula={`Invested assets (pension + stocks/shares) grow at ${percent(INVESTED_RATE)} a year; cash grows at ${percent(CASH_RATE)} a year. Both compounded monthly to age ${result.targetAge}.`}
            numbers={`invested ${money(result.investedFuture)} + cash ${money(result.cashFuture)} = ${money(result.projectedTotal)} over ${result.monthsToTarget} months`}
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
    </div>
  )
}
