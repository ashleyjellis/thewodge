/**
 * The wealth planning tool's year-by-year table — ending position split across all
 * four pots, plus what was put in and what grew that year. Same shape as the free
 * calculator's YearlyTable, extended from three pots to four. The row where growth
 * first outweighs that year's contribution is marked, same rule as everywhere else.
 *
 * The invested and cash rates are editable per row — "I think growth slows from
 * year 12" shouldn't require changing the assumption for every year. An edited
 * cell is visually marked so it's always clear which years are still on the
 * assumption and which have been manually tweaked; "Clear manual rates" resets
 * every row back to the assumption in one go.
 *
 * `generation` remounts the rate cells (so their own typed-but-uncommitted text
 * resets) whenever the baseline plan changes or the clear button is pressed —
 * without it, ordinary typing in one cell would fight a controlled value derived
 * from props. It must NOT change on ordinary per-cell edits, or cells would lose
 * keystrokes mid-type.
 */
import { useState } from 'react'
import { money, percent } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Assumptions } from '@/lib/forecast'
import { rateToPct } from '@/lib/wealthPlanSearch'
import type { RateOverride, WealthPlanYearPoint } from '@/lib/wealthPlan'

type RateField = 'investedRate' | 'cashRate'

export function WealthPlanYearlyTable({
  yearly,
  crossoverYear,
  assumptions,
  overrides,
  onOverrideChange,
  onClearOverrides,
  generation,
}: {
  yearly: WealthPlanYearPoint[]
  crossoverYear: number | null
  assumptions: Assumptions
  overrides: RateOverride[]
  onOverrideChange: (year: number, field: RateField, pct: number | undefined) => void
  onClearOverrides: () => void
  generation: number
}) {
  const lastAge = yearly[yearly.length - 1]?.age
  const overrideByYear = new Map(overrides.map((o) => [o.year, o]))
  const hasOverrides = overrides.length > 0

  return (
    <div className="rounded-3xl bg-card p-7 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Year by year</h2>
          <p className="mt-2 max-w-lg text-[13px] text-muted-foreground">
            Ending position for every pot, every year to {lastAge}, plus what you
            put in (including any bonus) and what grew that year — assuming{' '}
            {percent(assumptions.investedRate)} a year on investments and pension,{' '}
            {percent(assumptions.cashRate)} a year on cash. Edit either rate for any
            year directly in the table.
          </p>
        </div>
        {hasOverrides ? (
          <button
            type="button"
            onClick={onClearOverrides}
            className="shrink-0 text-[12px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Clear manual rates
          </button>
        ) : null}
      </div>

      <div className="mt-5 max-h-[480px] overflow-y-auto overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[900px] text-[13px] tabular-nums">
          <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-20 border-r border-border bg-card py-2 pr-2.5 font-medium">
                Age
              </th>
              <th className="py-2 pr-2.5 font-medium">Invested</th>
              <th className="py-2 pr-2.5 font-medium">Cash</th>
              <th className="py-2 pr-2.5 text-right font-medium">Pension</th>
              <th className="py-2 pr-2.5 text-right font-medium">ISA S&amp;S</th>
              <th className="py-2 pr-2.5 text-right font-medium">ISA cash</th>
              <th className="py-2 pr-2.5 text-right font-medium">Cash</th>
              <th className="py-2 pr-2.5 text-right font-medium">Total</th>
              <th className="py-2 pr-2.5 text-right font-medium">Put in</th>
              <th className="py-2 text-right font-medium">Grew</th>
            </tr>
          </thead>
          <tbody>
            {yearly.map((p) => {
              const isCrossover = p.year === crossoverYear
              const override = overrideByYear.get(p.year)
              return (
                <tr
                  key={p.year}
                  className={cn(
                    'border-t border-border',
                    isCrossover && 'bg-accent/30',
                  )}
                >
                  <td
                    // always a solid, non-transparent background — this cell sits on
                    // top of every other column as they scroll underneath it, and a
                    // translucent bg-accent/30 here let that scrolled content show
                    // through, which read as the number "behind" the age. The row
                    // tint above still carries the crossover colour on every column
                    // except this frozen one.
                    className="sticky left-0 z-[5] whitespace-nowrap border-r border-border bg-card py-2 pr-2.5 text-muted-foreground"
                  >
                    {p.age}
                    {isCrossover ? (
                      <span className="ml-1.5 hidden rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-foreground sm:inline-block">
                        crossover
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-2.5">
                    {p.year === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <RateCell
                        key={`${generation}-${p.year}-invested`}
                        pct={rateToPct(override?.investedRate ?? assumptions.investedRate)}
                        overridden={override?.investedRate !== undefined}
                        onChange={(v) => onOverrideChange(p.year, 'investedRate', v)}
                      />
                    )}
                  </td>
                  <td className="py-1.5 pr-2.5">
                    {p.year === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <RateCell
                        key={`${generation}-${p.year}-cash`}
                        pct={rateToPct(override?.cashRate ?? assumptions.cashRate)}
                        overridden={override?.cashRate !== undefined}
                        onChange={(v) => onOverrideChange(p.year, 'cashRate', v)}
                      />
                    )}
                  </td>
                  <td className="py-2 pr-2.5 text-right text-muted-foreground">
                    {money(p.pots.pension.endValue)}
                  </td>
                  <td className="py-2 pr-2.5 text-right text-muted-foreground">
                    {money(p.pots.isaStocks.endValue)}
                  </td>
                  <td className="py-2 pr-2.5 text-right text-muted-foreground">
                    {money(p.pots.isaCash.endValue)}
                  </td>
                  <td className="py-2 pr-2.5 text-right text-muted-foreground">
                    {money(p.pots.cashSavings.endValue)}
                  </td>
                  <td className="py-2 pr-2.5 text-right font-semibold text-foreground">
                    {money(p.total.endValue)}
                  </td>
                  <td className="py-2 pr-2.5 text-right text-muted-foreground">
                    {p.year === 0 ? '—' : money(p.total.contribution)}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">
                    {p.year === 0 ? '—' : money(p.total.growth)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[12px] text-muted-foreground">
        “Put in” is every contribution that pot received that year, including a
        bonus if you aimed one at it. “Grew” is everything above that — the
        market’s share, not yours. Highlighted rate cells have been manually
        edited for that year only; every other year still follows the assumption.
      </p>
    </div>
  )
}

function RateCell({
  pct,
  overridden,
  onChange,
}: {
  pct: number
  overridden: boolean
  onChange: (pct: number | undefined) => void
}) {
  const [value, setValue] = useState(() => String(pct))

  const handle = (raw: string) => {
    const cleaned = raw.replace(/[^\d.]/g, '')
    const firstDot = cleaned.indexOf('.')
    const filtered =
      firstDot === -1
        ? cleaned
        : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
    setValue(filtered)

    if (filtered.trim() === '') {
      onChange(undefined)
      return
    }
    const n = Number(filtered)
    if (Number.isFinite(n) && n >= 0) onChange(n / 100)
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg px-1.5 py-1 ring-1 transition-colors',
        overridden
          ? 'bg-accent/15 ring-accent'
          : 'bg-background ring-border focus-within:ring-foreground/40',
      )}
    >
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => handle(e.target.value)}
        className="w-8 bg-transparent text-right text-[13px] font-medium tabular-nums text-foreground outline-none"
      />
      <span className="text-[11px] text-muted-foreground">%</span>
    </span>
  )
}
