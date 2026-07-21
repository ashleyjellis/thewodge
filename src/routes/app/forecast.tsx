/**
 * The Forecast tab (spec §4) — the household's plan, how reality is tracking
 * against it, and a deliberate way to fork a new plan when life changes,
 * without ever losing the original.
 */
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { useHousehold } from '@/state/useHousehold'
import { useAccounts } from '@/state/useAccounts'
import { useSnapshots } from '@/state/useSnapshots'
import { useForecast } from '@/state/useForecast'
import { usePlan } from '@/state/usePlan'
import { postJson } from '@/lib/apiClient'
import { forecast, projectYearly, type YearPoint } from '@/lib/forecast'
import {
  buildForecastYearRows,
  buildPotScenarios,
  ownerStateToForecastInput,
  type FrozenForecastState,
  type OwnerFilter,
  type PotFilter,
} from '@/lib/householdForecast'
import { buildScheduledPlan } from '@/lib/scheduledPlan'
import { money } from '@/lib/format'
import { cn } from '@/lib/cn'
import { HowWeWorkedThisOut, Working } from '@/components/HowWeWorkedThisOut'
import { ForecastYearTable } from '@/components/app/ForecastYearTable'
import { PlanTable } from '@/components/app/PlanTable'
import { AppField } from '@/components/app/AppField'
import { FilterPill } from '@/components/app/FilterPill'
import { NavLink } from '@/components/NavLink'

const forecastSeo = seo({
  title: `Forecast — ${SITE_NAME}`,
  description: 'Your plan, how reality is tracking against it, and a deliberate way to replan.',
  path: '/app/forecast',
})

/** The scenarios table varies exactly one lever at a time, so it never
 *  offers the combined "Savings + Investments" pot — see buildPotScenarios. */
const SCENARIO_POT_FILTERS: { value: Exclude<PotFilter, 'savingsAndInvestments'>; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'cash', label: 'Savings' },
  { value: 'investments', label: 'Investments' },
  { value: 'pension', label: 'Pension' },
]

export const Route = createFileRoute('/app/forecast')({
  head: () => ({
    links: forecastSeo.links,
    meta: [...forecastSeo.meta, { name: 'robots', content: 'noindex' }],
  }),
  component: Forecast,
})

function Forecast() {
  const { household, people, loading: householdLoading, error: householdError } = useHousehold()
  const { accounts, loading: accountsLoading } = useAccounts(household?.id ?? null)
  const { snapshots, loading: snapshotsLoading } = useSnapshots(household?.id ?? null)
  const {
    ready,
    current,
    original,
    loading: forecastLoading,
    error: forecastError,
    refetch,
  } = useForecast(household?.id ?? null)
  const {
    contributionChanges,
    plannedEvents,
    addContributionChange,
    addPlannedEvent,
    removePlannedEvent,
  } = usePlan(household?.id ?? null)

  const [owner, setOwner] = useState<OwnerFilter>('total')
  const [pot, setPot] = useState<PotFilter>('total')
  const [scenariosPot, setScenariosPot] = useState<Exclude<PotFilter, 'savingsAndInvestments'>>('total')
  const [planPot, setPlanPot] = useState<PotFilter>('total')
  const [replanning, setReplanning] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const header = (
    <div>
      <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Plan
      </p>
      <h1 className="mt-2 text-[26px] font-semibold tracking-tight">Forecast</h1>
      <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
        Your plan, how reality is tracking against it, and a deliberate way to
        change course when life does.
      </p>
    </div>
  )

  if (householdLoading || accountsLoading || snapshotsLoading || forecastLoading) {
    return <p className="text-[14px] text-muted-foreground">Loading…</p>
  }
  if (householdError || !household) {
    return (
      <p className="text-[14px] text-muted-foreground">
        Couldn’t load your household{householdError ? `: ${householdError}` : ''}.
      </p>
    )
  }
  if (forecastError) {
    return (
      <div className="space-y-10">
        {header}
        <p className="text-[14px] text-muted-foreground">Couldn’t load your forecast: {forecastError}</p>
      </div>
    )
  }
  if (!ready || !current || !original) {
    return (
      <div className="space-y-10">
        {header}
        <p className="text-[14px] text-muted-foreground">
          Add at least one person and one account on the{' '}
          <NavLink to="/app/accounts" className="underline underline-offset-2">
            Accounts tab
          </NavLink>{' '}
          first — Forecast projects the real numbers set up there.
        </p>
      </div>
    )
  }

  const ownerOptions: { value: OwnerFilter; label: string }[] = [
    { value: 'total', label: 'Total household' },
    ...(people[0] ? [{ value: 'person_a' as const, label: people[0].name }] : []),
    ...(people[1] ? [{ value: 'person_b' as const, label: people[1].name }] : []),
    { value: 'joint', label: 'Joint' },
  ]

  const currentState: FrozenForecastState = JSON.parse(current.householdStateJson)
  const resolvedCurrent =
    ownerStateToForecastInput(currentState, owner) ?? ownerStateToForecastInput(currentState, 'total')
  if (!resolvedCurrent) {
    return (
      <div className="space-y-10">
        {header}
        <p className="text-[14px] text-muted-foreground">
          Your plan needs to be recreated — reload this page to fix it automatically.
        </p>
      </div>
    )
  }
  const { input, assumptions } = resolvedCurrent
  const result = forecast(input, assumptions)

  const hasReplanned = current.id !== original.id
  let originalYearly: YearPoint[] | null = null
  if (hasReplanned) {
    const originalState: FrozenForecastState = JSON.parse(original.householdStateJson)
    const originalResolved =
      ownerStateToForecastInput(originalState, owner) ?? ownerStateToForecastInput(originalState, 'total')
    if (originalResolved) {
      originalYearly = projectYearly(originalResolved.input, originalResolved.assumptions)
    }
  }

  const ownerAccounts = owner === 'total' ? accounts : accounts.filter((a) => a.owner === owner)
  const currentCalendarYear = new Date().getUTCFullYear()
  const rows = buildForecastYearRows({
    planYearly: result.yearly,
    planCreatedAt: current.createdAt,
    originalYearly,
    originalCreatedAt: hasReplanned ? original.createdAt : null,
    hasReplanned,
    accounts: ownerAccounts,
    snapshots,
    currentCalendarYear,
    pot,
  })
  // the live Plan table — always reflects the current schedule immediately,
  // unlike everything above which reads from the frozen baseline
  const planDefaultOwner = owner === 'total' ? (people[0] ? 'person_a' : 'joint') : owner
  const planPoints = buildScheduledPlan({
    owner,
    startYear: currentCalendarYear - 1,
    people,
    household,
    accounts,
    changes: contributionChanges,
    events: plannedEvents,
  })

  const potScenarios = buildPotScenarios(input, assumptions, scenariosPot)
  const scenariosPotLabel =
    scenariosPot === 'total' ? 'investments' : scenariosPot === 'cash' ? 'savings' : scenariosPot

  const submitReplan = async () => {
    setSaving(true)
    setError(null)
    try {
      await postJson('/api/forecast', { householdId: household.id, note })
      setNote('')
      setReplanning(false)
      await refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to replan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-10">
      {header}

      <div className="flex flex-wrap gap-1">
        {ownerOptions.map((opt) => (
          <FilterPill key={opt.value} active={owner === opt.value} onClick={() => setOwner(opt.value)}>
            {opt.label}
          </FilterPill>
        ))}
      </div>

      {hasReplanned ? (
        <div className="rounded-3xl bg-accent/30 p-6">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            You replanned
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-foreground">
            “{current.note}” —{' '}
            {new Date(current.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            . Your original plan is still shown alongside this one below, faded — it never
            disappears.
          </p>
        </div>
      ) : null}

      <div className="rounded-3xl bg-card p-7 shadow-soft">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">What changes if you change</h2>
            <p className="mt-2 max-w-lg text-[13px] text-muted-foreground">
              {scenariosPot === 'total'
                ? `What varying your investment contribution alone does — pension and cash carry on as they are — each shown at ${result.targetAge}.`
                : `What varying your ${scenariosPotLabel} contribution alone does — everything else carries on as it is — each shown at ${result.targetAge}.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {SCENARIO_POT_FILTERS.map((p) => (
              <FilterPill key={p.value} active={scenariosPot === p.value} onClick={() => setScenariosPot(p.value)}>
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
                  {result.targetAge}
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

      {planPoints ? (
        <PlanTable
          points={planPoints}
          pot={planPot}
          onPotChange={setPlanPot}
          people={people}
          accounts={accounts}
          defaultOwner={planDefaultOwner}
          investedRate={household.realReturn}
          cashRate={household.cashReturn}
          contributionChanges={contributionChanges}
          plannedEvents={plannedEvents}
          onAddContributionChange={addContributionChange}
          onAddPlannedEvent={addPlannedEvent}
          onRemovePlannedEvent={removePlannedEvent}
        />
      ) : null}

      <ForecastYearTable
        rows={rows}
        pot={pot}
        onPotChange={setPot}
      />

      <div className="rounded-3xl bg-card p-7 shadow-soft">
        <HowWeWorkedThisOut>
          <Working
            formula="Pension and investments grow at your set rate; cash grows at a separate, lower rate. Compounded monthly."
            numbers={`pension ${money(result.pension.future)} + investments ${money(result.stocks.future)} + cash ${money(result.cash.future)} = ${money(result.projectedTotal)}`}
          />
          <Working
            formula="Actual, for each year, is the latest balance you've recorded on the Growth tab in or before that year — never a guess."
            numbers="years you haven't updated yet show no actual figure, rather than assuming one"
          />
          <p>
            Your plan is frozen the moment it's set — changing your accounts afterwards doesn't
            quietly move it. Replan explicitly if life changes.
          </p>
        </HowWeWorkedThisOut>
      </div>

      <div className="rounded-3xl bg-card p-6 shadow-soft">
        <h3 className="text-[15px] font-semibold tracking-tight">Replan</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Life changes — a house, a new child, a pay rise. Replanning keeps your original plan
          visible, faded, alongside the new one.
        </p>
        {replanning ? (
          <div className="mt-4">
            <AppField
              label="What changed"
              placeholder="bought the house"
              value={note}
              onChange={setNote}
            />
            {error ? <p className="mt-2 text-[13px] text-muted-foreground">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={saving || !note.trim()}
                onClick={() => void submitReplan()}
                className="rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save replan'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReplanning(false)
                  setError(null)
                }}
                className="rounded-full px-5 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setReplanning(true)}
            className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-95"
          >
            Replan
          </button>
        )}
      </div>
    </div>
  )
}
