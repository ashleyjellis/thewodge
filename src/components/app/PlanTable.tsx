/**
 * The live Plan table (spec extension, feedback round 3) — an editable,
 * event-driven projection shown above the frozen Year-by-year table. Unlike
 * that table, this always reflects the current schedule immediately: no
 * Replan ceremony, no frozen baseline. Years run left to right as columns,
 * one pot at a time (Pension/Investments/Cash each carry their own growth
 * rate, unlike a single flattened balance).
 */
import { useState } from 'react'
import type { AccountOwner } from '@/lib/accountOwner'
import type { PotCategory, PotFilter } from '@/lib/householdForecast'
import {
  resolveContributionBreakdown,
  type ContributionBreakdownRow,
  type ContributionChangeType,
  type ScheduledPlanAccount,
  type ScheduledPotYearPoint,
  type ScheduledYearPoint,
} from '@/lib/scheduledPlan'
import { money, percent } from '@/lib/format'
import { cn } from '@/lib/cn'
import { FilterPill } from './FilterPill'
import { AddPlannedEventModal } from './AddPlannedEventModal'
import { ContributionBreakdown } from './ContributionBreakdown'
import { EditContributionModal } from './EditContributionModal'
import { LifeEventPicker } from './LifeEventPicker'
import type { ContributionChange, PlannedEvent } from '@/state/usePlan'

const POT_FILTERS: { value: PotFilter; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'cash', label: 'Savings' },
  { value: 'investments', label: 'Investments' },
  { value: 'pension', label: 'Pension' },
  { value: 'savingsAndInvestments', label: 'Savings + Investments' },
]

function potPoint(point: ScheduledYearPoint, pot: PotFilter): ScheduledPotYearPoint {
  if (pot === 'pension') return point.pension
  if (pot === 'investments') return point.investments
  if (pot === 'cash') return point.cash
  if (pot === 'savingsAndInvestments') {
    const inv = point.investments
    const cash = point.cash
    return {
      startValue: inv.startValue + cash.startValue,
      contribution: inv.contribution + cash.contribution,
      events: inv.events + cash.events,
      growth: inv.growth + cash.growth,
      endValue: inv.endValue + cash.endValue,
    }
  }
  return point.total
}

export function PlanTable({
  points,
  pot,
  onPotChange,
  people,
  accounts,
  defaultOwner,
  investedRate,
  cashRate,
  contributionChanges,
  plannedEvents,
  onAddContributionChange,
  onAddPlannedEvent,
  onRemovePlannedEvent,
}: {
  /** the live projection, year 0 = today's snapshot, year 1 = this calendar year onward */
  points: ScheduledYearPoint[]
  pot: PotFilter
  onPotChange: (pot: PotFilter) => void
  people: { id: string; name: string; salary: number | null }[]
  accounts: ScheduledPlanAccount[]
  defaultOwner: AccountOwner
  investedRate: number
  cashRate: number
  contributionChanges: ContributionChange[]
  plannedEvents: PlannedEvent[]
  onAddContributionChange: (input: {
    owner: AccountOwner
    potCategory: PotCategory
    effectiveYear: number
    changeType: ContributionChangeType
    value: number
    note?: string
  }) => Promise<void>
  onAddPlannedEvent: (input: {
    owner: AccountOwner
    potCategory: PotCategory
    year: number
    name: string
    amount: number
  }) => Promise<void>
  onRemovePlannedEvent: (id: string) => Promise<void>
}) {
  const [horizon, setHorizon] = useState<5 | 10>(10)
  const [breakdownYear, setBreakdownYear] = useState<number | null>(null)
  const [growingRow, setGrowingRow] = useState<{ owner: AccountOwner; potCategory: PotCategory; year: number } | null>(
    null,
  )
  const [addingEventYear, setAddingEventYear] = useState<number | null>(null)
  const [fallbackEventYear, setFallbackEventYear] = useState<number | null>(null)

  const columns = points.slice(1, 1 + horizon)
  if (columns.length === 0) return null

  const pots: PotCategory[] =
    pot === 'total'
      ? ['pension', 'investments', 'cash']
      : pot === 'savingsAndInvestments'
        ? ['investments', 'cash']
        : [pot]
  const eventsInView = plannedEvents.filter(
    (e) => pots.includes(e.potCategory) && columns.some((c) => c.calendarYear === e.year),
  )
  const eventsTotal = eventsInView.reduce((s, e) => s + e.amount, 0)
  const thisYearMonthly = potPoint(columns[0]!, pot).contribution / 12
  const rateLabel =
    pot === 'total' || pot === 'savingsAndInvestments'
      ? `Invested ${percent(investedRate)} · Cash ${percent(cashRate)}`
      : percent(pot === 'cash' ? cashRate : investedRate)

  const row = (label: string, cell: (c: ScheduledYearPoint) => string, opts?: { bold?: boolean }) => (
    <tr className="border-t border-border">
      <td className="sticky left-0 bg-card py-2.5 pr-4 text-[13px] font-medium text-muted-foreground">
        {label}
      </td>
      {columns.map((c) => (
        <td
          key={c.calendarYear}
          className={cn('min-w-[110px] py-2.5 pr-4 text-right tabular-nums', opts?.bold && 'font-semibold')}
        >
          {cell(c)}
        </td>
      ))}
    </tr>
  )

  return (
    <div className="rounded-3xl bg-card p-7 shadow-soft">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Plan</h2>
          <p className="mt-2 max-w-lg text-[13px] text-muted-foreground">
            A working projection you can edit — future contribution changes and one-off
            events, updated live. Your Forecast plan below stays exactly as it was until you
            replan.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {([5, 10] as const).map((h) => (
            <FilterPill key={h} active={horizon === h} onClick={() => setHorizon(h)}>
              {h} Year
            </FilterPill>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1">
        {POT_FILTERS.map((p) => (
          <FilterPill key={p.value} active={pot === p.value} onClick={() => onPotChange(p.value)}>
            {p.label}
          </FilterPill>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-muted/60 p-4 text-[13px] sm:grid-cols-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Growth rate</p>
          <p className="mt-1 font-semibold">{rateLabel}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Monthly now</p>
          <p className="mt-1 font-semibold">{money(thisYearMonthly)}/mo</p>
        </div>
        <div className="col-span-2">
          <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            Planned events, this view
          </p>
          <p className="mt-1 font-semibold">
            {eventsInView.length > 0 ? `${money(eventsTotal)} total` : 'None'}
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl">
        <table className="w-full text-[13px] tabular-nums">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="sticky left-0 bg-card pb-2 pr-4 font-medium">Year</th>
              {columns.map((c) => (
                <th key={c.calendarYear} className="min-w-[110px] pb-2 pr-4 text-right font-medium">
                  {c.calendarYear}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {row('Starting balance', (c) => money(potPoint(c, pot).startValue))}
            <tr className="border-t border-border">
              <td className="sticky left-0 bg-card py-2.5 pr-4 align-top text-[13px] font-medium text-muted-foreground">
                Contributions
              </td>
              {columns.map((c) => {
                const changesThisYear = contributionChanges.filter(
                  (ch) => pots.includes(ch.potCategory) && ch.effectiveYear === c.calendarYear,
                )
                return (
                  <td key={c.calendarYear} className="min-w-[110px] py-2.5 pr-4 align-top text-right">
                    <button
                      type="button"
                      onClick={() => setBreakdownYear(c.calendarYear)}
                      className="underline decoration-dotted underline-offset-4 hover:text-foreground"
                    >
                      {money(potPoint(c, pot).contribution)}
                    </button>
                    {changesThisYear.map((ch) => (
                      <div key={ch.id} className="mt-1 text-[11px] text-muted-foreground">
                        {ch.changeType === 'set'
                          ? 'changed'
                          : ch.changeType === 'grow_pct'
                            ? `+${percent(ch.value)}/yr from here`
                            : `${money(ch.value)}/yr bonus from here`}
                      </div>
                    ))}
                  </td>
                )
              })}
            </tr>
            <tr className="border-t border-border">
              <td className="sticky left-0 bg-card py-2.5 pr-4 align-top text-[13px] font-medium text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Planned events</span>
                  <button
                    type="button"
                    onClick={() => setAddingEventYear(columns[0]!.calendarYear)}
                    className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-foreground transition-opacity hover:opacity-80"
                  >
                    + Add
                  </button>
                </div>
              </td>
              {columns.map((c) => {
                const yearEvents = eventsInView.filter((e) => e.year === c.calendarYear)
                return (
                  <td key={c.calendarYear} className="min-w-[110px] py-2.5 pr-4 align-top text-right">
                    <span>{money(potPoint(c, pot).events)}</span>
                    {yearEvents.map((e) => (
                      <div key={e.id} className="mt-1 text-[11px] text-muted-foreground">
                        {e.name}{' '}
                        <button
                          type="button"
                          onClick={() => void onRemovePlannedEvent(e.id)}
                          aria-label={`Remove ${e.name}`}
                          className="ml-0.5 hover:text-foreground"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </td>
                )
              })}
            </tr>
            {row('Projected growth', (c) => money(potPoint(c, pot).growth))}
            {row('End balance', (c) => money(potPoint(c, pot).endValue), { bold: true })}
          </tbody>
        </table>
      </div>

      {breakdownYear !== null ? (
        <ContributionBreakdown
          year={breakdownYear}
          rows={resolveContributionBreakdown({
            year: breakdownYear,
            accounts,
            changes: contributionChanges,
          })}
          people={people}
          onSaveRow={async (row: ContributionBreakdownRow, input) => {
            if (input.monthly !== row.monthly) {
              await onAddContributionChange({
                owner: row.owner,
                potCategory: row.potCategory,
                effectiveYear: breakdownYear,
                changeType: 'set',
                value: input.monthly,
              })
            }
            if (input.annualBonus !== row.annualBonus) {
              await onAddContributionChange({
                owner: row.owner,
                potCategory: row.potCategory,
                effectiveYear: breakdownYear,
                changeType: 'annual_bonus',
                value: input.annualBonus,
              })
            }
          }}
          onGrowInsteadRow={(row) =>
            setGrowingRow({ owner: row.owner, potCategory: row.potCategory, year: breakdownYear })
          }
          onClose={() => setBreakdownYear(null)}
        />
      ) : null}

      {growingRow !== null ? (
        <EditContributionModal
          people={people}
          years={columns.map((c) => c.calendarYear)}
          defaultOwner={growingRow.owner}
          defaultPotCategory={growingRow.potCategory}
          defaultYear={growingRow.year}
          defaultChangeType="grow_pct"
          lockOwnerPotYear
          onSave={onAddContributionChange}
          onClose={() => setGrowingRow(null)}
        />
      ) : null}

      {addingEventYear !== null ? (
        <LifeEventPicker
          people={people}
          accounts={accounts}
          contributionChanges={contributionChanges}
          years={columns.map((c) => c.calendarYear)}
          defaultYear={addingEventYear}
          onAddContributionChange={onAddContributionChange}
          onSomethingElse={() => {
            setFallbackEventYear(addingEventYear)
            setAddingEventYear(null)
          }}
          onClose={() => setAddingEventYear(null)}
        />
      ) : null}

      {fallbackEventYear !== null ? (
        <AddPlannedEventModal
          people={people}
          years={columns.map((c) => c.calendarYear)}
          defaultOwner={defaultOwner}
          defaultPotCategory={pot === 'total' || pot === 'savingsAndInvestments' ? 'investments' : pot}
          defaultYear={fallbackEventYear}
          onSave={onAddPlannedEvent}
          onClose={() => setFallbackEventYear(null)}
        />
      ) : null}
    </div>
  )
}
