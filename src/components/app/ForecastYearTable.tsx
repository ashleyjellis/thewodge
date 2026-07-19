/**
 * The Forecast tab's year-by-year table (spec §4) — plan against what's
 * actually happened, with the original baseline shown as a faded secondary
 * column once a replan exists ("the fork must stay visible, never
 * disappear"). Reproduces the free tool's YearlyTable style. Variance never
 * says "behind" — see varianceLabel().
 */
import { money } from '@/lib/format'
import { cn } from '@/lib/cn'
import { varianceLabel, type ForecastYearRow } from '@/lib/householdForecast'

export function ForecastYearTable({
  rows,
  crossoverCalendarYear,
}: {
  rows: ForecastYearRow[]
  crossoverCalendarYear: number | null
}) {
  const hasOriginal = rows.some((r) => r.originalTotal !== null)
  const lastAge = rows[rows.length - 1]?.age

  return (
    <div className="rounded-3xl bg-card p-7 shadow-soft">
      <h2 className="text-[15px] font-semibold tracking-tight">Year by year</h2>
      <p className="mt-2 max-w-lg text-[13px] text-muted-foreground">
        Your plan against what's actually happened, every year to {lastAge}.
      </p>

      <div className="mt-5 max-h-[420px] overflow-y-auto overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[640px] text-[13px] tabular-nums">
          <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 font-medium">Age</th>
              {hasOriginal ? (
                <th className="py-2 pr-3 text-right font-medium">Original plan</th>
              ) : null}
              <th className="py-2 pr-3 text-right font-medium">Plan</th>
              <th className="py-2 pr-3 text-right font-medium">Actual</th>
              <th className="py-2 text-right font-medium">Variance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isCrossover = row.calendarYear === crossoverCalendarYear
              return (
                <tr
                  key={row.calendarYear}
                  className={cn('border-t border-border', isCrossover && 'bg-accent/30')}
                >
                  <td className="py-2.5 pr-3 text-muted-foreground">
                    {row.age}
                    {isCrossover ? (
                      <span className="ml-2 inline-block rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground">
                        market takes the lead
                      </span>
                    ) : null}
                  </td>
                  {hasOriginal ? (
                    <td className="py-2.5 pr-3 text-right text-muted-foreground/50">
                      {row.originalTotal !== null ? money(row.originalTotal) : '—'}
                    </td>
                  ) : null}
                  <td className="py-2.5 pr-3 text-right font-semibold text-foreground">
                    {money(row.planTotal)}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-muted-foreground">
                    {row.actualTotal !== null ? money(row.actualTotal) : '—'}
                  </td>
                  <td className="py-2.5 text-right text-muted-foreground">
                    {row.actualTotal !== null
                      ? `${money(row.actualTotal - row.planTotal)} · ${varianceLabel(row.actualTotal, row.planTotal)}`
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
