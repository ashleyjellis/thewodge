/**
 * "What changes if you change" — varies exactly one contribution lever at a
 * time, so it never offers the combined "Savings + Investments" pot (see
 * buildPotScenarios). Extracted from the Forecast tab so /app2's Plan
 * section can reuse it unchanged, without duplicating the table markup.
 */
import type { ForecastInput, Assumptions } from '@/lib/forecast'
import { buildPotScenarios, type PotFilter } from '@/lib/householdForecast'
import { money } from '@/lib/format'
import { cn } from '@/lib/cn'
import { FilterPill } from './FilterPill'

export const SCENARIO_POT_FILTERS: {
  value: Exclude<PotFilter, 'savingsAndInvestments'>
  label: string
}[] = [
  { value: 'total', label: 'Total' },
  { value: 'cash', label: 'Savings' },
  { value: 'investments', label: 'Investments' },
  { value: 'pension', label: 'Pension' },
]

export function ScenariosTable({
  input,
  assumptions,
  scenariosPot,
  onScenariosPotChange,
}: {
  input: ForecastInput
  assumptions: Assumptions
  scenariosPot: Exclude<PotFilter, 'savingsAndInvestments'>
  onScenariosPotChange: (pot: Exclude<PotFilter, 'savingsAndInvestments'>) => void
}) {
  const potScenarios = buildPotScenarios(input, assumptions, scenariosPot)
  const scenariosPotLabel =
    scenariosPot === 'total' ? 'investments' : scenariosPot === 'cash' ? 'savings' : scenariosPot

  return (
    <div className="rounded-3xl bg-card p-7 shadow-soft">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">What changes if you change</h2>
          <p className="mt-2 max-w-lg text-[13px] text-muted-foreground">
            {scenariosPot === 'total'
              ? `What varying your investment contribution alone does — pension and cash carry on as they are — each shown at ${assumptions.targetAge}.`
              : `What varying your ${scenariosPotLabel} contribution alone does — everything else carries on as it is — each shown at ${assumptions.targetAge}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {SCENARIO_POT_FILTERS.map((p) => (
            <FilterPill key={p.value} active={scenariosPot === p.value} onClick={() => onScenariosPotChange(p.value)}>
              {p.label}
            </FilterPill>
          ))}
        </div>
      </div>
      <div className="mt-5 overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[420px] text-[14px] tabular-nums">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="pb-2 font-medium">Choice</th>
              <th className="pb-2 text-right font-medium">To {scenariosPotLabel}</th>
              <th className="pb-2 text-right font-medium">
                {scenariosPot === 'total' ? 'Total' : SCENARIO_POT_FILTERS.find((p) => p.value === scenariosPot)?.label} at{' '}
                {assumptions.targetAge}
              </th>
            </tr>
          </thead>
          <tbody>
            {potScenarios.map((s) => (
              <tr key={s.key} className={cn('border-t border-border', s.current && 'bg-accent/40')}>
                <td className="py-3 pr-2">
                  <span className={cn(s.current && 'font-semibold')}>{s.label}</span>
                  {s.current ? (
                    <span className="ml-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      now
                    </span>
                  ) : null}
                </td>
                <td className="py-3 text-right text-muted-foreground">
                  {s.monthly > 0 ? money(s.monthly) : '—'}
                </td>
                <td className="py-3 text-right font-semibold">
                  {money(scenariosPot === 'total' ? s.total : s.potTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
