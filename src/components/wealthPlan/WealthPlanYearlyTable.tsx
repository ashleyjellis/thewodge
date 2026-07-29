/**
 * The wealth planning tool's year-by-year table — ending position split across all
 * four pots, plus what was put in and what grew that year. Same shape as the free
 * calculator's YearlyTable, extended from three pots to four. The row where growth
 * first outweighs that year's contribution is marked, same rule as everywhere else.
 */
import { money } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { WealthPlanYearPoint } from '@/lib/wealthPlan'

export function WealthPlanYearlyTable({
  yearly,
  crossoverYear,
}: {
  yearly: WealthPlanYearPoint[]
  crossoverYear: number | null
}) {
  const lastAge = yearly[yearly.length - 1]?.age

  return (
    <div className="rounded-3xl bg-card p-7 shadow-soft">
      <h2 className="text-[15px] font-semibold tracking-tight">Year by year</h2>
      <p className="mt-2 max-w-lg text-[13px] text-muted-foreground">
        Ending position for every pot, every year to {lastAge}, plus what you put in
        and what grew that year.
      </p>

      <div className="mt-5 max-h-[480px] overflow-y-auto overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[760px] text-[13px] tabular-nums">
          <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 font-medium">Age</th>
              <th className="py-2 pr-3 text-right font-medium">Pension</th>
              <th className="py-2 pr-3 text-right font-medium">ISA S&amp;S</th>
              <th className="py-2 pr-3 text-right font-medium">ISA cash</th>
              <th className="py-2 pr-3 text-right font-medium">Cash</th>
              <th className="py-2 pr-3 text-right font-medium">Total</th>
              <th className="py-2 pr-3 text-right font-medium">Put in</th>
              <th className="py-2 text-right font-medium">Grew</th>
            </tr>
          </thead>
          <tbody>
            {yearly.map((p) => {
              const isCrossover = p.year === crossoverYear
              return (
                <tr
                  key={p.year}
                  className={cn(
                    'border-t border-border',
                    isCrossover && 'bg-accent/30',
                  )}
                >
                  <td className="py-2.5 pr-3 text-muted-foreground">
                    {p.age}
                    {isCrossover ? (
                      <span className="ml-2 inline-block rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground">
                        market takes the lead
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-muted-foreground">
                    {money(p.pots.pension.endValue)}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-muted-foreground">
                    {money(p.pots.isaStocks.endValue)}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-muted-foreground">
                    {money(p.pots.isaCash.endValue)}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-muted-foreground">
                    {money(p.pots.cashSavings.endValue)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-semibold text-foreground">
                    {money(p.total.endValue)}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-muted-foreground">
                    {p.year === 0 ? '—' : money(p.total.contribution)}
                  </td>
                  <td className="py-2.5 text-right text-muted-foreground">
                    {p.year === 0 ? '—' : money(p.total.growth)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[12px] text-muted-foreground">
        Pension grows from what you hold today plus your % contribution; ISA cash
        and cash savings grow at the cash rate; ISA stocks &amp; shares and pension
        grow at the invested rate. Your bonus, if you added one, lands at the end of
        whichever year it's given.
      </p>
    </div>
  )
}
