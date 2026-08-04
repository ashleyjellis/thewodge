/**
 * The disposable "what if" sandbox (spec §3.2) — poke at a pot's monthly
 * contribution, watch the plan ripple instantly, close it, nothing saved.
 * Deliberately a different mechanism from editing the live Plan table: every
 * change here lives in this component's own local state, merged with the
 * real schedule only for this component's own projection call. There is no
 * postJson/patchJson/sendDelete anywhere in this file — not a policy, a
 * structural guarantee that this can never overwrite the real plan.
 *
 * Self-contained (fetches its own household/accounts/plan data) rather than
 * threaded through DashboardBody as props — DashboardBody is shared with
 * /app's own Dashboard tab, which doesn't get this feature, so its prop
 * surface stays untouched.
 */
import { useState } from 'react'
import { useHousehold } from '@/state/useHousehold'
import { useAccounts } from '@/state/useAccounts'
import { usePlan } from '@/state/usePlan'
import type { PotCategory } from '@/lib/householdForecast'
import { buildScheduledPlan, type OwnerScopedContributionChange } from '@/lib/scheduledPlan'
import { money } from '@/lib/format'
import { AppField } from './AppField'
import { FilterPill } from './FilterPill'

const POTS: { value: PotCategory; label: string }[] = [
  { value: 'pension', label: 'Pension' },
  { value: 'investments', label: 'Investments' },
  { value: 'cash', label: 'Cash' },
]

export function TodayIfSandbox() {
  const { household, people, loading: householdLoading } = useHousehold()
  const { accounts, loading: accountsLoading } = useAccounts(household?.id ?? null)
  const { contributionChanges, plannedEvents, loading: planLoading } = usePlan(household?.id ?? null)

  const [open, setOpen] = useState(false)
  const [pot, setPot] = useState<PotCategory>('investments')
  const [monthlyInput, setMonthlyInput] = useState('')

  const close = () => {
    setOpen(false)
    setMonthlyInput('')
  }

  if (
    householdLoading ||
    accountsLoading ||
    planLoading ||
    !household ||
    people.length === 0 ||
    accounts.length === 0
  ) {
    return null
  }

  if (!open) {
    return (
      <div className="rounded-3xl bg-card p-7 shadow-soft sm:p-8">
        <p className="text-[15px] font-semibold tracking-tight">Today if…</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Poke at a number and see the plan ripple — nothing here is saved.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-95"
        >
          Try it →
        </button>
      </div>
    )
  }

  const currentCalendarYear = new Date().getUTCFullYear()
  const startYear = currentCalendarYear - 1

  const baseMonthlyForPot = accounts
    .filter((a) => a.potCategory === pot)
    .reduce((s, a) => s + a.monthlyContribution, 0)
  const sandboxValue = monthlyInput.trim() === '' ? baseMonthlyForPot : Math.max(0, Number(monthlyInput) || 0)

  const sandboxChange: OwnerScopedContributionChange = {
    owner: 'joint',
    potCategory: pot,
    effectiveYear: currentCalendarYear,
    changeType: 'set',
    value: sandboxValue,
  }

  const scheduledPlanArgs = { owner: 'total' as const, startYear, people, household, accounts }
  const baselinePoints = buildScheduledPlan({
    ...scheduledPlanArgs,
    changes: contributionChanges,
    events: plannedEvents,
  })
  const sandboxPoints = buildScheduledPlan({
    ...scheduledPlanArgs,
    changes: [...contributionChanges, sandboxChange],
    events: plannedEvents,
  })

  const baselineLast = baselinePoints?.[baselinePoints.length - 1]
  const sandboxLast = sandboxPoints?.[sandboxPoints.length - 1]

  return (
    <div className="rounded-3xl bg-card p-7 shadow-soft sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] font-semibold tracking-tight">Today if…</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Nothing here is saved — close it and it’s gone.
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          className="shrink-0 text-[13px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Close
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {POTS.map((p) => (
          <FilterPill
            key={p.value}
            active={pot === p.value}
            onClick={() => {
              setPot(p.value)
              setMonthlyInput('')
            }}
          >
            {p.label}
          </FilterPill>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <AppField
          label={`Monthly to ${POTS.find((p) => p.value === pot)!.label.toLowerCase()}`}
          prefix="£"
          inputMode="decimal"
          value={monthlyInput}
          onChange={setMonthlyInput}
          placeholder={String(baseMonthlyForPot)}
          className="w-40"
        />
        <button
          type="button"
          onClick={() => setMonthlyInput('0')}
          className="rounded-full bg-muted px-4 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted/70"
        >
          Stop contributing
        </button>
      </div>

      {baselineLast && sandboxLast ? (
        <div className="mt-6 rounded-2xl bg-accent/30 p-5">
          <p className="text-[13px] text-muted-foreground">By {sandboxLast.age}, this becomes</p>
          <p className="mt-1 text-[32px] font-semibold leading-none tracking-tight tabular-nums">
            {money(sandboxLast.total.endValue)}
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {sandboxLast.total.endValue >= baselineLast.total.endValue ? '+' : '−'}
            {money(Math.abs(sandboxLast.total.endValue - baselineLast.total.endValue))} against your actual plan (
            {money(baselineLast.total.endValue)})
          </p>
        </div>
      ) : null}
    </div>
  )
}
