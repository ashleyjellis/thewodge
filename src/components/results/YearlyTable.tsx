/**
 * Yearly table — ending position split by pension, investments and cash, plus the
 * capital you put in and what grew that year. The row where growth first
 * outweighs that year's contribution is marked — the point contributions become
 * the minor part of the story.
 */
import { money } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { YearPoint } from '@/lib/forecast'

export function YearlyTable({
  yearly,
  crossoverYear,
}: {
  yearly: YearPoint[]
  crossoverYear: number | null
}) {
  const lastAge = yearly[yearly.length - 1]?.age

  return (
    <div className="rounded-3xl bg-card p-7 shadow-soft">
      <h2 className="text-[15px] font-semibold tracking-tight">Year by year</h2>
      <p className="mt-2 max-w-lg text-[13px] text-muted-foreground">
        Ending position split by pot, every year to {lastAge}, plus what you put in
        and what grew that year.
      </p>

      <div className="mt-5 max-h-[420px] overflow-y-auto overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[640px] text-[13px] tabular-nums">
          <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 font-medium">Age</th>
              <th className="py-2 pr-3 text-right font-medium">Pension</th>
              <th className="py-2 pr-3 text-right font-medium">Investments</th>
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
                    {money(p.pension.endValue)}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-muted-foreground">
                    {money(p.stocks.endValue)}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-muted-foreground">
                    {money(p.cash.endValue)}
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
        Pension and cash here grow from what you hold today; the monthly
        contribution is modelled against investments, as entered above.
      </p>
    </div>
  )
}
