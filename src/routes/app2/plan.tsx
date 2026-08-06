/**
 * Plan — the forecast + the sandbox (spec §4). Still a near-direct copy of
 * /app/forecast.tsx's content (owner filter, scenarios, the live Plan
 * table, the year-by-year ledger, workings) rather than a shared component
 * with it — deliberate, not an oversight: the checkpoint mechanic below
 * (added on top of the old Replan block, which /app/forecast.tsx still has
 * alone) is the first real divergence, and Phase 4 diverges further still.
 * Extracting a shared component now would mean un-extracting it again
 * almost immediately. ScenariosTable was extracted because it *isn't*
 * changing, so both pages get it for free.
 */
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { DOWN_YEAR_RATE, SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { useHousehold } from '@/state/useHousehold'
import { useAccounts } from '@/state/useAccounts'
import { useSnapshots } from '@/state/useSnapshots'
import { useForecast } from '@/state/useForecast'
import { useCheckpoints } from '@/state/useCheckpoints'
import { usePlan } from '@/state/usePlan'
import { patchJson, postJson } from '@/lib/apiClient'
import { forecast, projectYearly, type YearPoint } from '@/lib/forecast'
import {
  buildForecastYearRows,
  isValidFrozenState,
  ownerStateToForecastInput,
  type ForecastYearRow,
  type FrozenForecastState,
  type OwnerFilter,
  type PotFilter,
} from '@/lib/householdForecast'
import { buildScheduledForecastYearRows, buildScheduledPlan, buildScheduledPlanInput } from '@/lib/scheduledPlan'
import { checkpointSchedule } from '@/lib/checkpointState'
import { buildPlanBand, orderedBandRange } from '@/lib/planBand'
import { money, percent } from '@/lib/format'
import { BandChart, type BandPoint } from '@/components/BandChart'
import { HowWeWorkedThisOut, Working } from '@/components/HowWeWorkedThisOut'
import { ForecastYearTable } from '@/components/app/ForecastYearTable'
import { PlanTable } from '@/components/app/PlanTable'
import { AppField } from '@/components/app/AppField'
import { FilterPill } from '@/components/app/FilterPill'
import { ScenariosTable } from '@/components/app/ScenariosTable'
import { NavLink } from '@/components/NavLink'

const DOWN_YEAR_OPTIONS = [0, 1, 2, 3, 5]

const planSeo = seo({
  title: `Plan — ${SITE_NAME}`,
  description: 'Your plan, how reality is tracking against it, and a deliberate way to replan.',
  path: '/app2/plan',
})

export const Route = createFileRoute('/app2/plan')({
  head: () => ({
    links: planSeo.links,
    meta: [...planSeo.meta, { name: 'robots', content: 'noindex' }],
  }),
  component: Plan,
})

function Plan() {
  const {
    household,
    people,
    loading: householdLoading,
    error: householdError,
    refetch: refetchHousehold,
  } = useHousehold()
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
  const { history: checkpointHistory, saveCheckpoint } = useCheckpoints(household?.id ?? null)

  const [owner, setOwner] = useState<OwnerFilter>('total')
  const [pot, setPot] = useState<PotFilter>('total')
  const [scenariosPot, setScenariosPot] = useState<Exclude<PotFilter, 'savingsAndInvestments'>>('total')
  const [planPot, setPlanPot] = useState<PotFilter>('total')
  const [replanning, setReplanning] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkpointLabel, setCheckpointLabel] = useState('')
  const [savingCheckpoint, setSavingCheckpoint] = useState(false)
  const [checkpointError, setCheckpointError] = useState<string | null>(null)
  const [checkpointSaved, setCheckpointSaved] = useState(false)
  const [savingDownYears, setSavingDownYears] = useState(false)

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
          <NavLink to="/app2/accounts" className="underline underline-offset-2">
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

  // Once a checkpoint exists, the year-by-year ledger switches from the flat
  // baseline (a single monthly figure assumed forever) to a replay of
  // exactly what was scheduled at checkpoint time — the same
  // ForecastYearRow shape, so ForecastYearTable renders either without
  // changes. Falls back to the flat baseline above when there's no
  // checkpoint yet, or its stored state predates a valid FrozenForecastState.
  const latestCheckpoint = [...checkpointHistory].reverse().find((h) => h.type === 'checkpoint') ?? null
  let scheduledRows: ForecastYearRow[] | null = null
  if (latestCheckpoint) {
    const parsed: unknown = JSON.parse(latestCheckpoint.householdStateJson)
    if (isValidFrozenState(parsed)) {
      scheduledRows = buildScheduledForecastYearRows({
        checkpoint: { ...parsed, ...checkpointSchedule(parsed) },
        checkpointCreatedAt: latestCheckpoint.createdAt,
        owner,
        accounts,
        snapshots,
        currentCalendarYear,
        pot,
      })
    }
  }
  const tableRows = scheduledRows ?? rows

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

  // the down-years stress test — same live schedule as the Plan table above,
  // projected three ways (see planBand.ts). null only when this owner
  // filter has no one to project for, same condition buildScheduledPlan
  // itself returns null under.
  const bandInput = buildScheduledPlanInput({
    owner,
    startYear: currentCalendarYear - 1,
    people,
    household,
    accounts,
    changes: contributionChanges,
    events: plannedEvents,
  })
  const band = bandInput ? buildPlanBand(bandInput, household.downYearsCount) : null

  // mid/low/high are all projected from the same input/startYear/targetAge
  // (just different rateOverrides), so they share identical length and
  // calendarYear at every index — a straight zip, no year-lookup needed.
  // orderedBandRange guards a real quirk of "worst placement vs best
  // placement": only the FINAL value is guaranteed low <= high by
  // construction — at an intermediate year they can genuinely cross (a
  // late loss on a large balance can cost more than an early loss on a
  // small one), which would otherwise read backwards or self-intersect.
  const bandPoints: BandPoint[] = band
    ? band.mid.points.map((p, i) => {
        const { low, high } = orderedBandRange(band.low.points[i]!.total.endValue, band.high.points[i]!.total.endValue)
        return { x: String(p.calendarYear), low, mid: p.total.endValue, high }
      })
    : []

  // overlays the band's low/high onto whichever ledger rows are showing
  // (flat baseline or schedule-aware) — household total only, regardless of
  // the table's own pot filter, matching the down-years card above it.
  // Only when a genuine (non-zero-width) band exists, so a table full of
  // "£X – £X" rows never appears when downYearsCount is 0.
  const hasBand = band !== null && band.lowStartYear !== null
  const lowByYear = new Map(hasBand ? band!.low.points.map((p) => [p.calendarYear, p.total.endValue]) : [])
  const highByYear = new Map(hasBand ? band!.high.points.map((p) => [p.calendarYear, p.total.endValue]) : [])
  const tableRowsWithRange: ForecastYearRow[] = tableRows.map((row) => {
    const rawLow = lowByYear.get(row.calendarYear)
    const rawHigh = highByYear.get(row.calendarYear)
    const ordered = rawLow !== undefined && rawHigh !== undefined ? orderedBandRange(rawLow, rawHigh) : null
    return { ...row, lowValue: ordered?.low ?? null, highValue: ordered?.high ?? null }
  })

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

  const submitCheckpoint = async () => {
    setSavingCheckpoint(true)
    setCheckpointError(null)
    try {
      await saveCheckpoint(checkpointLabel)
      setCheckpointLabel('')
      setCheckpointSaved(true)
      await refetch()
    } catch (err) {
      setCheckpointError(err instanceof Error ? err.message : 'failed to save checkpoint')
    } finally {
      setSavingCheckpoint(false)
    }
  }

  const setDownYearsCount = async (n: number) => {
    setSavingDownYears(true)
    try {
      await patchJson('/api/household', { id: household.id, downYearsCount: n })
      await refetchHousehold()
    } finally {
      setSavingDownYears(false)
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
            Since your original plan
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-foreground">
            {current.note ? `“${current.note}” — ` : ''}
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

      <ScenariosTable
        input={input}
        assumptions={assumptions}
        scenariosPot={scenariosPot}
        onScenariosPotChange={setScenariosPot}
      />

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

      {band ? (
        <div className="rounded-3xl bg-card p-6 shadow-soft">
          <h3 className="text-[15px] font-semibold tracking-tight">Down-years stress test</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            How many down years should we test your plan against? A down year knocks pension and
            investments by {percent(Math.abs(DOWN_YEAR_RATE))} instead of growing that year — cash
            is never affected.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {DOWN_YEAR_OPTIONS.map((n) => (
              <FilterPill key={n} active={household.downYearsCount === n} onClick={() => void setDownYearsCount(n)}>
                {n === 0 ? 'Off' : `${n} year${n === 1 ? '' : 's'}`}
              </FilterPill>
            ))}
            {savingDownYears ? <span className="self-center text-[12px] text-muted-foreground">Saving…</span> : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-accent/30 p-4">
              <p className="text-[12px] text-muted-foreground">Low</p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums">
                {money(band.low.points.at(-1)!.total.endValue)}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {band.lowStartYear ? `down years from ${band.lowStartYear}` : 'no down years applied'}
              </p>
            </div>
            <div className="rounded-2xl bg-accent/30 p-4">
              <p className="text-[12px] text-muted-foreground">Mid</p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums">
                {money(band.mid.points.at(-1)!.total.endValue)}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">no down years applied</p>
            </div>
            <div className="rounded-2xl bg-accent/30 p-4">
              <p className="text-[12px] text-muted-foreground">High</p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums">
                {money(band.high.points.at(-1)!.total.endValue)}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {band.highStartYear ? `down years from ${band.highStartYear}` : 'no down years applied'}
              </p>
            </div>
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
            Low and High are the SAME down years, just placed at the worst and best possible moment
            in your plan — not "no bad years happen" versus "some do." A real down-run can only ever
            cost you something, so High still sits below Mid.
          </p>

          <BandChart points={bandPoints} className="mt-5" />

          <div className="mt-4">
            <HowWeWorkedThisOut>
              {hasBand ? (
                <Working
                  formula={`Low and High both apply ${household.downYearsCount} down year${household.downYearsCount === 1 ? '' : 's'} in a row — Low starting the worst possible year we found for it, High the best.`}
                  numbers={`worst placement: ${band!.lowStartYear} · best placement: ${band!.highStartYear}`}
                />
              ) : (
                <p>No down years applied — Low, Mid and High are the same plain projection.</p>
              )}
              <Working
                formula="Crossover: the first year growth adds more than you contribute that year — the point contributions become the minor part of the story."
                numbers={`Mid crosses over ${band!.mid.crossoverYear ?? 'not within this horizon'}${hasBand ? ` · Low ${band!.low.crossoverYear ?? 'not within this horizon'} · High ${band!.high.crossoverYear ?? 'not within this horizon'}` : ''}`}
              />
            </HowWeWorkedThisOut>
          </div>
        </div>
      ) : null}

      <div>
        {scheduledRows ? (
          <p className="mb-3 text-[13px] text-muted-foreground">
            Against the schedule as it stood at your last checkpoint,{' '}
            {new Date(latestCheckpoint!.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}{' '}
            — growth and contributions below are what that schedule actually implied, not a flat
            guess.
          </p>
        ) : null}
        <ForecastYearTable rows={tableRowsWithRange} pot={pot} onPotChange={setPot} />
      </div>

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
        <h3 className="text-[15px] font-semibold tracking-tight">Save checkpoint</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          A quick check-in, right now — no note required. See the full history on the Accounts
          tab.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <AppField
            label="Label (optional)"
            placeholder="just checking in"
            value={checkpointLabel}
            onChange={(v) => {
              setCheckpointLabel(v)
              setCheckpointSaved(false)
            }}
            className="w-64"
          />
          <button
            type="button"
            disabled={savingCheckpoint}
            onClick={() => void submitCheckpoint()}
            className="rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-40"
          >
            {savingCheckpoint ? 'Saving…' : 'Save checkpoint'}
          </button>
        </div>
        {checkpointError ? (
          <p className="mt-2 text-[13px] text-muted-foreground">{checkpointError}</p>
        ) : null}
        {checkpointSaved ? <p className="mt-2 text-[13px] text-muted-foreground">Saved.</p> : null}
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
