/**
 * The Insights tab (restructure brief) — a read-only narrative over the
 * same data Forecast and Dashboard already compute. No inputs of its own:
 * every observation here is specific to this household's actual numbers
 * and variance, never a generic tip that could appear unchanged in any
 * user's app.
 */
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { useHousehold } from '@/state/useHousehold'
import { useAccounts } from '@/state/useAccounts'
import { useSnapshots } from '@/state/useSnapshots'
import { useForecast } from '@/state/useForecast'
import { forecast } from '@/lib/forecast'
import {
  buildForecastYearRows,
  ownerStateToForecastInput,
  varianceLabel,
  type FrozenForecastState,
  type OwnerFilter,
} from '@/lib/householdForecast'
import { accountGrowthVsAssumed } from '@/lib/snapshotMath'
import { money, percent } from '@/lib/format'
import { FilterPill } from '@/components/app/FilterPill'
import { NavLink } from '@/components/NavLink'

const insightsSeo = seo({
  title: `Insights — ${SITE_NAME}`,
  description: "What's notable about your plan, read off your own numbers.",
  path: '/app/insights',
})

export const Route = createFileRoute('/app/insights')({
  head: () => ({
    links: insightsSeo.links,
    meta: [...insightsSeo.meta, { name: 'robots', content: 'noindex' }],
  }),
  component: Insights,
})

function Insights() {
  const { household, people, loading: householdLoading, error: householdError } = useHousehold()
  const { accounts, loading: accountsLoading } = useAccounts(household?.id ?? null)
  const { snapshots, loading: snapshotsLoading } = useSnapshots(household?.id ?? null)
  const {
    ready,
    current,
    loading: forecastLoading,
    error: forecastError,
  } = useForecast(household?.id ?? null)

  const [owner, setOwner] = useState<OwnerFilter>('total')

  const header = (
    <div>
      <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Insights
      </p>
      <h1 className="mt-2 text-[26px] font-semibold tracking-tight">Insights</h1>
      <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
        What's notable about your plan right now — read off your own numbers, nothing
        generic.
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
  if (!ready || !current) {
    return (
      <div className="space-y-10">
        {header}
        <p className="text-[14px] text-muted-foreground">
          Add at least one person and one account on the{' '}
          <NavLink to="/app/accounts" className="underline underline-offset-2">
            Accounts tab
          </NavLink>{' '}
          first — Insights reads off your Forecast plan.
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

  const ownerAccounts = owner === 'total' ? accounts : accounts.filter((a) => a.owner === owner)
  const currentCalendarYear = new Date().getUTCFullYear()
  const liveTotal = ownerAccounts.reduce((sum, a) => sum + (a.currentBalance ?? 0), 0)

  const rows = buildForecastYearRows({
    planYearly: result.yearly,
    planCreatedAt: current.createdAt,
    originalYearly: null,
    originalCreatedAt: null,
    hasReplanned: false,
    accounts: ownerAccounts,
    snapshots,
    currentCalendarYear,
    pot: 'total',
  })
  const latestActualRow = [...rows].reverse().find((r) => r.actualValue !== null) ?? null

  // the single account whose actual growth has diverged most from its
  // pot's assumed rate — the most narratively interesting one, not a full
  // table dump of every account
  const accountVariances = ownerAccounts
    .map((account) => {
      const accountSnapshots = snapshots
        .filter((s) => s.accountId === account.id)
        .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
      const assumedRate = account.potCategory === 'cash' ? household.cashReturn : household.realReturn
      const g = accountGrowthVsAssumed(accountSnapshots, assumedRate)
      if (!g) return null
      return { account, assumedRate, variance: g.actualGrowth - g.assumedGrowth, ...g }
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
  const mostNotableAccount =
    accountVariances.length > 0
      ? accountVariances.reduce((a, b) => (Math.abs(b.variance) > Math.abs(a.variance) ? b : a))
      : null

  const hasAnyVarianceInsight = latestActualRow !== null || mostNotableAccount !== null

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

      <div className="rounded-3xl bg-card p-7 shadow-soft sm:p-10">
        <p className="text-[13px] text-muted-foreground">
          Today you hold{' '}
          <span className="font-semibold tabular-nums text-foreground">{money(liveTotal)}</span>.
        </p>
        <p className="mt-4 text-[17px] leading-snug text-muted-foreground sm:text-[19px]">
          By {result.targetAge} you're on track for
        </p>
        <div className="mt-2 text-[52px] font-semibold leading-none tracking-tight tabular-nums sm:text-[68px]">
          {money(result.projectedTotal)}
        </div>
      </div>

      {result.crossoverYear !== null ? (
        <div className="rounded-3xl bg-accent/40 p-7 sm:p-8">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Worth knowing
          </p>
          <h2 className="mt-3 text-[20px] font-semibold leading-snug tracking-tight sm:text-[22px]">
            There's a year the market starts doing more than you do.
          </h2>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-foreground/80">
            From around age {input.age + result.crossoverYear}, growth on what you already hold
            typically adds more in a single year than everything you put in that year — check the
            Year-by-year table on Forecast for the exact year.
          </p>
        </div>
      ) : null}

      {latestActualRow ? (
        <div className="rounded-3xl bg-card p-7 shadow-soft">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Plan vs reality
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-foreground">
            {latestActualRow.actualValue === latestActualRow.forecastValue ? (
              <>
                As of {latestActualRow.calendarYear}, you're exactly on plan — both say{' '}
                <span className="font-semibold tabular-nums">{money(latestActualRow.forecastValue)}</span>.
              </>
            ) : (
              <>
                As of {latestActualRow.calendarYear}, you're{' '}
                <span className="font-semibold tabular-nums">
                  {money(Math.abs(latestActualRow.actualValue! - latestActualRow.forecastValue))}
                </span>{' '}
                {varianceLabel(latestActualRow.actualValue!, latestActualRow.forecastValue)} — your
                plan said {money(latestActualRow.forecastValue)}, your accounts actually hold{' '}
                {money(latestActualRow.actualValue!)}.
              </>
            )}
          </p>
        </div>
      ) : null}

      {mostNotableAccount ? (
        <div className="rounded-3xl bg-card p-7 shadow-soft">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Standout account
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-foreground">
            <span className="font-semibold">{mostNotableAccount.account.provider}</span>'s growth is{' '}
            {varianceLabel(mostNotableAccount.actualGrowth, mostNotableAccount.assumedGrowth)}: it's
            grown {money(mostNotableAccount.actualGrowth)} since you started tracking it, against{' '}
            {money(mostNotableAccount.assumedGrowth)} its {percent(mostNotableAccount.assumedRate)}{' '}
            assumption would have implied.
          </p>
        </div>
      ) : null}

      {!hasAnyVarianceInsight ? (
        <p className="text-[14px] text-muted-foreground">
          Update your balances on the{' '}
          <NavLink to="/app/growth" className="underline underline-offset-2">
            Growth tab
          </NavLink>{' '}
          to start seeing how reality compares to plan.
        </p>
      ) : null}
    </div>
  )
}
