/**
 * The household's home-screen content — a quick, always-live glance (never
 * the frozen Forecast baseline): who's in the plan, roughly where you're
 * headed, and what your accounts hold right now. Extracted from the
 * Dashboard tab so /app2's Today section can reuse it unchanged.
 */
import { useHousehold } from '@/state/useHousehold'
import { useAccounts } from '@/state/useAccounts'
import { useSnapshots } from '@/state/useSnapshots'
import { greetingForHour } from '@/lib/greeting'
import { aggregateHouseholdState, ownerStateToForecastInput } from '@/lib/householdForecast'
import { forecast } from '@/lib/forecast'
import { PeopleStrip } from './PeopleStrip'
import { MilestoneHeadline } from './MilestoneHeadline'
import { WealthByAccount } from './WealthByAccount'
import { NavLink } from '@/components/NavLink'

export function DashboardBody({ accountsPath }: { accountsPath: string }) {
  const { household, people, loading: householdLoading, error: householdError } = useHousehold()
  const {
    accounts,
    loading: accountsLoading,
    refetch: refetchAccounts,
  } = useAccounts(household?.id ?? null)
  const { snapshots, loading: snapshotsLoading, refetch: refetchSnapshots } = useSnapshots(
    household?.id ?? null,
  )

  const header = (
    <div>
      <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Dashboard
      </p>
      <h1 className="mt-2 text-[26px] font-semibold tracking-tight">
        {greetingForHour(new Date().getHours())}
        {people[0] ? `, ${people[0].name}` : ''}
      </h1>
    </div>
  )

  if (householdLoading || accountsLoading || snapshotsLoading) {
    return <p className="text-[14px] text-muted-foreground">Loading…</p>
  }
  if (householdError || !household) {
    return (
      <p className="text-[14px] text-muted-foreground">
        Couldn’t load your household{householdError ? `: ${householdError}` : ''}.
      </p>
    )
  }

  if (people.length === 0 || accounts.length === 0) {
    return (
      <div className="space-y-10">
        {header}
        <p className="text-[14px] text-muted-foreground">
          Add at least one person and one account on the{' '}
          <NavLink to={accountsPath} className="underline underline-offset-2">
            Accounts tab
          </NavLink>{' '}
          to see your household here.
        </p>
      </div>
    )
  }

  const state = aggregateHouseholdState(household, people, accounts)
  const totalResolved = ownerStateToForecastInput(state, 'total')
  if (!totalResolved) {
    return (
      <div className="space-y-10">
        {header}
        <p className="text-[14px] text-muted-foreground">Couldn’t work out your numbers right now.</p>
      </div>
    )
  }
  const byRetirement = forecast(totalResolved.input, totalResolved.assumptions).projectedTotal
  const by40 =
    totalResolved.input.age < 40
      ? forecast(totalResolved.input, { ...totalResolved.assumptions, targetAge: 40 }).projectedTotal
      : null

  const refetchAll = async () => {
    await Promise.all([refetchAccounts(), refetchSnapshots()])
  }

  return (
    <div className="space-y-10">
      {header}

      <PeopleStrip people={people} />

      <MilestoneHeadline
        by40={by40}
        byRetirement={byRetirement}
        retirementAge={totalResolved.assumptions.targetAge}
      />

      <WealthByAccount
        accounts={accounts}
        snapshots={snapshots}
        people={people}
        onSaved={refetchAll}
      />
    </div>
  )
}
