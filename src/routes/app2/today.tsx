/**
 * Today — the check-in screen. DashboardBody stays the shared, unchanged
 * glance (still reused by /app's own Dashboard tab); this file layers
 * Today's own bespoke behaviours on top of it: an ambient crossover
 * subtitle, a one-time full-screen moment on a genuine movement event, and
 * down-market reassurance in place of the ambient line when a real dip
 * still clears the down-years band's Low case (todayState.ts).
 */
import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { useHousehold } from '@/state/useHousehold'
import { useAccounts } from '@/state/useAccounts'
import { useSnapshots } from '@/state/useSnapshots'
import { usePlan } from '@/state/usePlan'
import { actualTotalAsOf, type PotCategory } from '@/lib/householdForecast'
import { buildPlanBand } from '@/lib/planBand'
import { buildScheduledPlanInput } from '@/lib/scheduledPlan'
import { resolveTodayState } from '@/lib/todayState'
import { DashboardBody } from '@/components/app/DashboardBody'
import { TodayIfSandbox } from '@/components/app/TodayIfSandbox'
import { CrossoverAmbient } from '@/components/app/CrossoverAmbient'
import { CrossoverFullScreenMoment } from '@/components/app/CrossoverFullScreenMoment'
import { DownMarketReassurance } from '@/components/app/DownMarketReassurance'
import { ExtraContributionShortcut } from '@/components/app/ExtraContributionShortcut'
import { MarginalValueCalculator } from '@/components/app/MarginalValueCalculator'

const todaySeo = seo({
  title: `Today — ${SITE_NAME}`,
  description: 'Your household, at a glance.',
  path: '/app2/today',
})

export const Route = createFileRoute('/app2/today')({
  validateSearch: (search: Record<string, unknown>): { justChanged?: string } => ({
    justChanged: typeof search.justChanged === 'string' ? search.justChanged : undefined,
  }),
  head: () => ({
    links: todaySeo.links,
    meta: [...todaySeo.meta, { name: 'robots', content: 'noindex' }],
  }),
  component: Today,
})

function Today() {
  const { justChanged } = Route.useSearch()
  const navigate = useNavigate()
  // captured once at mount, before the URL param below is stripped — the
  // param itself is consumed exactly once, never persisted, but this local
  // flag keeps the moment showing until the user dismisses it
  const [showMoment, setShowMoment] = useState(() => Boolean(justChanged))
  const [sandboxSeed, setSandboxSeed] = useState<{ pot: PotCategory; extraMonthly: number } | null>(null)

  useEffect(() => {
    if (justChanged) {
      void navigate({ to: '/app2/today', replace: true })
    }
    // run once on mount only — deliberately not reacting to justChanged
    // again after this, since re-navigating already clears it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { household, people } = useHousehold()
  const { accounts, loading: accountsLoading } = useAccounts(household?.id ?? null)
  const { snapshots } = useSnapshots(household?.id ?? null)
  const { contributionChanges, plannedEvents, loading: planLoading } = usePlan(household?.id ?? null)

  const currentCalendarYear = new Date().getUTCFullYear()
  // Waits for accounts/plan to actually finish loading, not just for
  // household — useAccounts/usePlan both default to an empty array while
  // loading, which buildScheduledPlanInput would happily accept and turn
  // into a real (but all-zero, no-growth) input. That earlier, wrong
  // crossoverYear (always null for an all-zero projection) would get
  // baked into MarginalValueCalculator's own initial "which horizon"
  // choice via its useState initializer and never correct itself once the
  // real data arrived — the same async-vs-lazy-init trap as elsewhere in
  // this app, just easier to miss here since nothing looked broken at a
  // glance.
  const bandInput =
    household && !accountsLoading && !planLoading
      ? buildScheduledPlanInput({
          owner: 'total',
          startYear: currentCalendarYear - 1,
          people,
          household,
          accounts,
          changes: contributionChanges,
          events: plannedEvents,
        })
      : null
  const band = bandInput && household ? buildPlanBand(bandInput, household.downYearsCount) : null
  const crossoverYear = band?.mid.crossoverYear ?? null

  const midAtNow = band?.mid.points.find((p) => p.calendarYear === currentCalendarYear) ?? null
  const lowAtNow = band?.low.points.find((p) => p.calendarYear === currentCalendarYear) ?? null
  const comparison =
    snapshots.length > 0 && midAtNow && lowAtNow
      ? {
          actualValue: actualTotalAsOf(accounts, snapshots, currentCalendarYear),
          midValue: midAtNow.total.endValue,
          lowValue: lowAtNow.total.endValue,
        }
      : null

  const todayState = resolveTodayState({ justChanged: showMoment, crossoverYear, comparison })

  return (
    <div className="space-y-10">
      {todayState.kind === 'full_screen_moment' ? (
        <CrossoverFullScreenMoment
          crossoverYear={todayState.crossoverYear}
          onDismiss={() => setShowMoment(false)}
        />
      ) : null}

      <DashboardBody accountsPath="/app2/accounts" />

      {todayState.kind === 'down_market_reassurance' ? (
        <DownMarketReassurance crossoverYear={todayState.crossoverYear} />
      ) : (
        <CrossoverAmbient crossoverYear={todayState.crossoverYear} />
      )}

      <ExtraContributionShortcut
        onModel={(extraMonthly) => setSandboxSeed({ pot: 'investments', extraMonthly })}
      />
      <TodayIfSandbox seed={sandboxSeed} />

      {household && bandInput ? (
        <MarginalValueCalculator
          currentAge={bandInput.age}
          crossoverYear={crossoverYear}
          currentCalendarYear={currentCalendarYear}
          annualRate={household.realReturn}
        />
      ) : null}
    </div>
  )
}
