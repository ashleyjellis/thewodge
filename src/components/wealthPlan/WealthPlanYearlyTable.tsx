/**
 * The wealth planning tool's year-by-year table.
 *
 * Defaults to a condensed view: one category at a time (Total, Pension,
 * Investments, Savings, or Savings & investments — everything except pension),
 * showing starting value, what was put in, what grew, and the running total for
 * just that slice. "Expand table to show all" switches to the full grid with
 * every pot broken out side by side — more powerful, but ten columns wide, so it
 * isn't the default on a phone.
 *
 * The invested and cash rates are editable per row in both views (when the
 * category maps to a single rate — Total and Savings & investments mix both
 * rates, so they're read-only; expand to edit those pots individually). An
 * edited cell is visually marked so it's always clear which years are still on
 * the assumption and which have been manually tweaked; "Clear manual rates"
 * resets every row back to the assumption in one go.
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
import type { Assumptions, PotYearPoint } from '@/lib/forecast'
import { rateToPct } from '@/lib/wealthPlanSearch'
import type {
  ContributionOverride,
  PotKey,
  RateOverride,
  WealthPlanYearPoint,
} from '@/lib/wealthPlan'

type RateField = 'investedRate' | 'cashRate'

type TableCategory = 'total' | 'pension' | 'investments' | 'savings' | 'savingsAndInvestments'

const CATEGORIES: TableCategory[] = [
  'total',
  'pension',
  'investments',
  'savings',
  'savingsAndInvestments',
]

const CATEGORY_LABELS: Record<TableCategory, string> = {
  total: 'Total',
  pension: 'Pension',
  investments: 'Investments',
  savings: 'Savings',
  savingsAndInvestments: 'Savings & investments',
}

const CATEGORY_POTS: Record<TableCategory, PotKey[]> = {
  total: ['pension', 'isaStocks', 'isaCash', 'cashSavings'],
  pension: ['pension'],
  investments: ['isaStocks'],
  savings: ['isaCash', 'cashSavings'],
  savingsAndInvestments: ['isaStocks', 'isaCash', 'cashSavings'],
}

/** Total and Savings & investments each mix invested- and cash-rate pots, so
 *  there's no single rate to show or edit for them — expand for that detail. */
const CATEGORY_RATE_FIELD: Record<TableCategory, RateField | null> = {
  total: null,
  pension: 'investedRate',
  investments: 'investedRate',
  savings: 'cashRate',
  savingsAndInvestments: null,
}

function categoryPoint(p: WealthPlanYearPoint, category: TableCategory): PotYearPoint {
  if (category === 'total') return p.total
  return CATEGORY_POTS[category].reduce<PotYearPoint>(
    (acc, key) => ({
      startValue: acc.startValue + p.pots[key].startValue,
      contribution: acc.contribution + p.pots[key].contribution,
      growth: acc.growth + p.pots[key].growth,
      endValue: acc.endValue + p.pots[key].endValue,
    }),
    { startValue: 0, contribution: 0, growth: 0, endValue: 0 },
  )
}

export function WealthPlanYearlyTable({
  yearly,
  crossoverYear,
  highlightYear,
  assumptions,
  overrides,
  onOverrideChange,
  onClearOverrides,
  contributionOverrides,
  onEditYear,
  onClearContributionOverrides,
  generation,
  editable,
}: {
  yearly: WealthPlanYearPoint[]
  crossoverYear: number | null
  /** briefly emphasised row, set by a "see it in the table" link above —
   *  see WealthPlanResults' jumpToYear */
  highlightYear: number | null
  assumptions: Assumptions
  overrides: RateOverride[]
  onOverrideChange: (year: number, field: RateField, pct: number | undefined) => void
  onClearOverrides: () => void
  contributionOverrides: ContributionOverride[]
  onEditYear: (year: number) => void
  onClearContributionOverrides: () => void
  generation: number
  /** false on a joint (multi-person) view — rates and contributions can only
   *  be tweaked one person at a time, so a combined view is look-only */
  editable: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [category, setCategory] = useState<TableCategory>('total')

  const lastAge = yearly[yearly.length - 1]?.age
  const overrideByYear = new Map(overrides.map((o) => [o.year, o]))
  const hasOverrides = editable && overrides.length > 0
  const contributionOverrideYears = new Set(contributionOverrides.map((o) => o.year))
  const hasContributionOverrides = editable && contributionOverrides.length > 0
  const rateField = CATEGORY_RATE_FIELD[category]

  return (
    <div className="rounded-3xl bg-card p-7 shadow-soft">
      <h2 className="text-[15px] font-semibold tracking-tight">Year by year</h2>
      <p className="mt-2 text-[13px] text-muted-foreground">
        {expanded ? (
          <>
            Ending position for every pot, every year to {lastAge}, plus what you
            put in (including any bonus) and what grew that year — assuming{' '}
            {percent(assumptions.investedRate)} a year on investments and pension,{' '}
            {percent(assumptions.cashRate)} a year on cash.{' '}
            {editable
              ? 'Edit either rate, or click a year\'s "put in" to change its contributions.'
              : "Switch to this person's own name above to edit their rates or contributions."}
          </>
        ) : (
          <>
            {CATEGORY_LABELS[category]}, every year to {lastAge} — starting value,
            what you put in (including any bonus) and what grew.{' '}
            {editable ? (
              <>
                {rateField === 'investedRate'
                  ? 'Edit the invested rate for any year — pension and investments share this assumption, so it changes both.'
                  : rateField === 'cashRate'
                    ? 'Edit the cash rate for any year directly in the table.'
                    : null}{' '}
                Click a year's "put in" to change its contributions.
              </>
            ) : (
              "Switch to this person's own name above to edit their rates or contributions."
            )}
          </>
        )}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {!expanded ? (
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors',
                  category === c
                    ? 'bg-foreground text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        ) : (
          <div />
        )}
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5">
          {hasOverrides ? (
            <button
              type="button"
              onClick={onClearOverrides}
              className="text-[12px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Clear manual rates
            </button>
          ) : null}
          {hasContributionOverrides ? (
            <button
              type="button"
              onClick={onClearContributionOverrides}
              className="text-[12px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Clear manual contributions
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[12px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {expanded ? 'Show condensed view' : 'Expand table to show all →'}
          </button>
        </div>
      </div>

      <div className="mt-5 max-h-[480px] overflow-y-auto overflow-x-auto rounded-2xl">
        {expanded ? (
          <ExpandedTable
            yearly={yearly}
            crossoverYear={crossoverYear}
            highlightYear={highlightYear}
            overrideByYear={overrideByYear}
            assumptions={assumptions}
            onOverrideChange={onOverrideChange}
            contributionOverrideYears={contributionOverrideYears}
            onEditYear={onEditYear}
            generation={generation}
            editable={editable}
          />
        ) : (
          <CondensedTable
            yearly={yearly}
            crossoverYear={crossoverYear}
            highlightYear={highlightYear}
            overrideByYear={overrideByYear}
            assumptions={assumptions}
            category={category}
            rateField={rateField}
            onOverrideChange={onOverrideChange}
            contributionOverrideYears={contributionOverrideYears}
            onEditYear={onEditYear}
            generation={generation}
            editable={editable}
          />
        )}
      </div>

      <p className="mt-4 text-[12px] text-muted-foreground">
        {editable ? (
          <>
            “Put in” is every contribution that pot received that year, including
            a bonus if you aimed one at it — click it to change that year's
            income, monthly contributions, or additional contribution. “Grew” is
            everything above that — the market’s share, not yours. Highlighted
            cells have been manually edited for that year only; every other year
            still follows the plan above.
          </>
        ) : (
          <>
            “Put in” is every contribution that pot received that year, including
            a bonus if aimed at it. “Grew” is everything above that — the
            market’s share, not anyone's.
          </>
        )}
      </p>
    </div>
  )
}

function CondensedTable({
  yearly,
  crossoverYear,
  highlightYear,
  overrideByYear,
  assumptions,
  category,
  rateField,
  onOverrideChange,
  contributionOverrideYears,
  onEditYear,
  generation,
  editable,
}: {
  yearly: WealthPlanYearPoint[]
  crossoverYear: number | null
  highlightYear: number | null
  overrideByYear: Map<number, RateOverride>
  assumptions: Assumptions
  category: TableCategory
  rateField: RateField | null
  onOverrideChange: (year: number, field: RateField, pct: number | undefined) => void
  contributionOverrideYears: Set<number>
  onEditYear: (year: number) => void
  generation: number
  editable: boolean
}) {
  return (
    <table className="w-full text-[13px] tabular-nums">
      <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        <tr>
          <th className="sticky left-0 z-20 border-r border-border bg-card py-2 pr-1.5 font-medium">
            Age
          </th>
          {rateField ? <th className="py-2 pl-2 pr-1.5 font-medium">Rate</th> : null}
          <th className="py-2 pr-1.5 text-right font-medium">Starting</th>
          <th className="py-2 pr-1.5 text-right font-medium">Put in</th>
          <th className="py-2 pr-1.5 text-right font-medium">Grew</th>
          <th className="py-2 text-right font-medium">Total</th>
        </tr>
      </thead>
      <tbody>
        {yearly.map((p) => {
          const isCrossover = p.year === crossoverYear
          const point = categoryPoint(p, category)
          const override = overrideByYear.get(p.year)
          const ratePct =
            rateField === 'investedRate'
              ? rateToPct(override?.investedRate ?? assumptions.investedRate)
              : rateField === 'cashRate'
                ? rateToPct(override?.cashRate ?? assumptions.cashRate)
                : null
          const rateOverridden =
            rateField === 'investedRate'
              ? override?.investedRate !== undefined
              : rateField === 'cashRate'
                ? override?.cashRate !== undefined
                : false

          return (
            <tr
              key={p.year}
              id={`plan-year-${p.year}`}
              className={cn(
                'border-t border-border transition-colors duration-700',
                isCrossover && 'bg-accent/30',
                p.year === highlightYear && 'bg-accent/60',
              )}
            >
              <td className="sticky left-0 z-[5] whitespace-nowrap border-r border-border bg-card py-2 pr-1.5 text-muted-foreground">
                {p.age}
                {isCrossover ? (
                  <span className="ml-1.5 hidden rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-foreground sm:inline-block">
                    crossover
                  </span>
                ) : null}
              </td>
              {rateField ? (
                <td className="py-1.5 pl-2 pr-1.5">
                  {p.year === 0 || ratePct === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : editable ? (
                    <RateCell
                      key={`${generation}-${p.year}-${rateField}`}
                      pct={ratePct}
                      overridden={rateOverridden}
                      onChange={(v) => onOverrideChange(p.year, rateField, v)}
                    />
                  ) : (
                    <span className="text-muted-foreground">{ratePct}%</span>
                  )}
                </td>
              ) : null}
              <td className="py-2 pr-1.5 text-right text-muted-foreground">
                {money(point.startValue)}
              </td>
              <td className="py-2 pr-1.5 text-right">
                <PutInCell
                  year={p.year}
                  value={point.contribution}
                  overridden={contributionOverrideYears.has(p.year)}
                  onClick={() => onEditYear(p.year)}
                  editable={editable}
                />
              </td>
              <td className="py-2 pr-1.5 text-right text-muted-foreground">
                {p.year === 0 ? '—' : money(point.growth)}
              </td>
              <td className="py-2 text-right font-semibold text-foreground">
                {money(point.endValue)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function ExpandedTable({
  yearly,
  crossoverYear,
  highlightYear,
  overrideByYear,
  assumptions,
  onOverrideChange,
  contributionOverrideYears,
  onEditYear,
  generation,
  editable,
}: {
  yearly: WealthPlanYearPoint[]
  crossoverYear: number | null
  highlightYear: number | null
  overrideByYear: Map<number, RateOverride>
  assumptions: Assumptions
  onOverrideChange: (year: number, field: RateField, pct: number | undefined) => void
  contributionOverrideYears: Set<number>
  onEditYear: (year: number) => void
  generation: number
  editable: boolean
}) {
  return (
    <table className="w-full min-w-[900px] text-[13px] tabular-nums">
      <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        <tr>
          <th className="sticky left-0 z-20 border-r border-border bg-card py-2 pr-2.5 font-medium">
            Age
          </th>
          <th className="py-2 pl-2 pr-2.5 font-medium">Invested</th>
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
              id={`plan-year-${p.year}`}
              className={cn(
                'border-t border-border transition-colors duration-700',
                isCrossover && 'bg-accent/30',
                p.year === highlightYear && 'bg-accent/60',
              )}
            >
              <td className="sticky left-0 z-[5] whitespace-nowrap border-r border-border bg-card py-2 pr-2.5 text-muted-foreground">
                {p.age}
                {isCrossover ? (
                  <span className="ml-1.5 hidden rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-foreground sm:inline-block">
                    crossover
                  </span>
                ) : null}
              </td>
              <td className="py-1.5 pl-2 pr-2.5">
                {p.year === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : editable ? (
                  <RateCell
                    key={`${generation}-${p.year}-invested`}
                    pct={rateToPct(override?.investedRate ?? assumptions.investedRate)}
                    overridden={override?.investedRate !== undefined}
                    onChange={(v) => onOverrideChange(p.year, 'investedRate', v)}
                  />
                ) : (
                  <span className="text-muted-foreground">
                    {rateToPct(override?.investedRate ?? assumptions.investedRate)}%
                  </span>
                )}
              </td>
              <td className="py-1.5 pr-2.5">
                {p.year === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : editable ? (
                  <RateCell
                    key={`${generation}-${p.year}-cash`}
                    pct={rateToPct(override?.cashRate ?? assumptions.cashRate)}
                    overridden={override?.cashRate !== undefined}
                    onChange={(v) => onOverrideChange(p.year, 'cashRate', v)}
                  />
                ) : (
                  <span className="text-muted-foreground">
                    {rateToPct(override?.cashRate ?? assumptions.cashRate)}%
                  </span>
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
              <td className="py-2 pr-2.5 text-right">
                <PutInCell
                  year={p.year}
                  value={p.total.contribution}
                  overridden={contributionOverrideYears.has(p.year)}
                  onClick={() => onEditYear(p.year)}
                  editable={editable}
                />
              </td>
              <td className="py-2 text-right text-muted-foreground">
                {p.year === 0 ? '—' : money(p.total.growth)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** Opens the per-year contribution editor. Shown for every row except year 0,
 *  which has no contribution to edit. Underlined to read as tappable, and
 *  picked out in the accent colour when that year has a saved override. */
function PutInCell({
  year,
  value,
  overridden,
  onClick,
  editable,
}: {
  year: number
  value: number
  overridden: boolean
  onClick: () => void
  editable: boolean
}) {
  if (year === 0) return <span className="text-muted-foreground">—</span>
  if (!editable) return <span>{money(value)}</span>
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'underline decoration-dotted underline-offset-4 transition-colors hover:decoration-solid',
        overridden
          ? 'font-semibold text-foreground decoration-accent hover:decoration-accent'
          : 'text-muted-foreground decoration-muted-foreground/50 hover:text-foreground hover:decoration-foreground',
      )}
    >
      {money(value)}
    </button>
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
