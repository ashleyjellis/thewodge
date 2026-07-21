/**
 * The Forecast tab's year-by-year table (restructure brief: this is the
 * tool's working ledger, plan against what's actually happened) — value,
 * growth and additions, forecast alongside actual, filterable by pot. The
 * original baseline's value shows as a faded secondary column once a
 * replan exists ("the fork must stay visible, never disappear"). Purely a
 * neutral record — the observational reading of this same data (the
 * crossover year, the variance narrative) lives on the Insights tab, not
 * here.
 */
import { money } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ForecastYearRow, PotFilter } from '@/lib/householdForecast'
import { FilterPill } from './FilterPill'

const POT_FILTERS: { value: PotFilter; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'cash', label: 'Savings' },
  { value: 'investments', label: 'Investments' },
  { value: 'pension', label: 'Pension' },
  { value: 'savingsAndInvestments', label: 'Savings + Investments' },
]

function cell(value: number | null, className?: string, divider?: boolean) {
  return (
    <td className={cn('py-2.5 pr-3 text-right', divider && 'border-l border-border pl-3', className)}>
      {value !== null ? money(value) : '—'}
    </td>
  )
}

export function ForecastYearTable({
  rows,
  pot,
  onPotChange,
}: {
  rows: ForecastYearRow[]
  pot: PotFilter
  onPotChange: (pot: PotFilter) => void
}) {
  const hasOriginal = rows.some((r) => r.originalValue !== null)
  const lastAge = rows[rows.length - 1]?.age

  return (
    <div className="rounded-3xl bg-card p-7 shadow-soft">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Year by year</h2>
          <p className="mt-2 max-w-lg text-[13px] text-muted-foreground">
            Value, growth and what you put in — plan against what's actually happened, every
            year to {lastAge}.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {POT_FILTERS.map((p) => (
            <FilterPill key={p.value} active={pot === p.value} onClick={() => onPotChange(p.value)}>
              {p.label}
            </FilterPill>
          ))}
        </div>
      </div>

      <div className="mt-5 max-h-[480px] overflow-y-auto overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[860px] text-[13px] tabular-nums">
          <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th rowSpan={2} className="py-2 pr-3 align-bottom font-medium">
                Age
              </th>
              {hasOriginal ? (
                <th rowSpan={2} className="py-2 pr-3 text-right align-bottom font-medium">
                  Original
                </th>
              ) : null}
              <th
                colSpan={2}
                className="border-l border-border py-2 pl-3 pr-3 text-center font-semibold text-foreground/70"
              >
                Value
              </th>
              <th
                colSpan={2}
                className="border-l border-border py-2 pl-3 pr-3 text-center font-semibold text-foreground/70"
              >
                Growth
              </th>
              <th
                colSpan={2}
                className="border-l border-border py-2 pl-3 pr-3 text-center font-semibold text-foreground/70"
              >
                Additions
              </th>
            </tr>
            <tr className="text-[10px]">
              <th className="border-l border-border pb-2 pl-3 pr-3 text-right font-normal">Forecast</th>
              <th className="pb-2 pr-3 text-right font-normal">Actual</th>
              <th className="border-l border-border pb-2 pl-3 pr-3 text-right font-normal">Forecast</th>
              <th className="pb-2 pr-3 text-right font-normal">Actual</th>
              <th className="border-l border-border pb-2 pl-3 pr-3 text-right font-normal">Forecast</th>
              <th className="pb-2 pr-3 text-right font-normal">Actual</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.calendarYear} className="border-t border-border">
                <td className="py-2.5 pr-3 text-muted-foreground">{row.age}</td>
                {hasOriginal ? cell(row.originalValue, 'text-muted-foreground/50') : null}
                {cell(row.forecastValue, 'font-semibold text-foreground', true)}
                {cell(row.actualValue, 'text-muted-foreground')}
                {cell(row.forecastGrowth, 'text-muted-foreground', true)}
                {cell(row.actualGrowth, 'text-muted-foreground')}
                {cell(row.forecastAdditions, 'text-muted-foreground', true)}
                {cell(row.actualAdditions, 'text-muted-foreground')}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
