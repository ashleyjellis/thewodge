/**
 * The Growth tab (spec §3) — the tracking loop, and the most important
 * interaction in the logged-in build. Update account balances whenever you
 * like — no forced monthly cadence — and every update separates "you added
 * this" from "the market did this." History is append-only; nothing here is
 * ever silently rewritten.
 */
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { surfaceSeo } from '@/lib/surfaceSeo'
import { useHousehold } from '@/state/useHousehold'
import { useAccounts } from '@/state/useAccounts'
import { useSnapshots } from '@/state/useSnapshots'
import type { AccountOwner } from '@/lib/accountOwner'
import { accountsInPot, type PotFilter } from '@/lib/householdForecast'
import { hasBeenUpdated, rollupSnapshotsByYear, totalGrowth } from '@/lib/snapshotMath'
import { money, monthYear } from '@/lib/format'
import { HowWeWorkedThisOut, Working } from '@/components/HowWeWorkedThisOut'
import { UpdateBalances } from '@/components/app/UpdateBalances'
import { AccountHistoryCard, type HistoryPeriod } from '@/components/app/AccountHistoryCard'
import { GrowthDiary } from '@/components/app/GrowthDiary'
import { FilterPill } from '@/components/app/FilterPill'

const growthSeo = surfaceSeo('app', {
  title: `Growth — ${SITE_NAME}`,
  description: 'Update your balances and see what you put in against what the market added.',
  path: '/app/growth',
})

export const Route = createFileRoute('/app/growth')({
  head: () => ({
    links: growthSeo.links,
    meta: growthSeo.meta,
  }),
  component: Growth,
})

const POT_FILTERS: { value: PotFilter; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'cash', label: 'Savings' },
  { value: 'investments', label: 'Investments' },
  { value: 'pension', label: 'Pension' },
  { value: 'savingsAndInvestments', label: 'Savings + Investments' },
]

function Growth() {
  const {
    household,
    people,
    loading: householdLoading,
    error: householdError,
  } = useHousehold()
  const {
    accounts,
    loading: accountsLoading,
    error: accountsError,
    refetch: refetchAccounts,
  } = useAccounts(household?.id ?? null)
  const {
    snapshots,
    loading: snapshotsLoading,
    refetch: refetchSnapshots,
  } = useSnapshots(household?.id ?? null)

  const [ownerFilter, setOwnerFilter] = useState<AccountOwner | 'all'>('all')
  const [potFilter, setPotFilter] = useState<PotFilter>('total')
  const [view, setView] = useState<'monthly' | 'annual'>('monthly')
  const [updating, setUpdating] = useState(false)

  if (householdLoading) {
    return <p className="text-[14px] text-muted-foreground">Loading…</p>
  }
  if (householdError || !household) {
    return (
      <p className="text-[14px] text-muted-foreground">
        Couldn’t load your household{householdError ? `: ${householdError}` : ''}.
      </p>
    )
  }

  const refetchAll = async () => {
    await Promise.all([refetchAccounts(), refetchSnapshots()])
  }

  const ownerOptions: { value: AccountOwner | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    ...(people[0] ? [{ value: 'person_a' as const, label: people[0].name }] : []),
    ...(people[1] ? [{ value: 'person_b' as const, label: people[1].name }] : []),
    { value: 'joint' as const, label: 'Joint' },
  ]

  const filteredAccounts = accountsInPot(
    accounts.filter((a) => ownerFilter === 'all' || a.owner === ownerFilter),
    potFilter,
  )
  const filteredIds = new Set(filteredAccounts.map((a) => a.id))
  const filteredSnapshots = snapshots.filter((s) => filteredIds.has(s.accountId))

  const totalWealth = filteredAccounts.reduce((sum, a) => sum + (a.currentBalance ?? 0), 0)
  const growth = totalGrowth(filteredSnapshots)
  // an account with only its opening entry hasn't been tracked yet — the hero
  // shouldn't present a household that's never used the update flow as though
  // it has a (zero) growth figure
  const hasTrackedGrowth = hasBeenUpdated(filteredSnapshots)

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Tracking
        </p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-tight">Growth</h1>
        <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
          Update whenever you like — no forced cadence, no missed-update nagging
          — and see what you added against what the market did.
        </p>
      </div>

      {accountsLoading ? (
        <p className="text-[14px] text-muted-foreground">Loading…</p>
      ) : accountsError ? (
        <p className="text-[14px] text-muted-foreground">Couldn’t load accounts: {accountsError}</p>
      ) : accounts.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">
          Add an account on the Accounts tab first — Growth tracks the real accounts you've set up there.
        </p>
      ) : (
        <>
          <div className="rounded-3xl bg-card p-7 shadow-soft sm:p-10">
            <p className="text-[13px] text-muted-foreground">Right now you hold</p>
            <div className="mt-2 text-[44px] font-semibold leading-none tracking-tight tabular-nums sm:text-[56px]">
              {money(totalWealth)}
            </div>
            <p className="mt-5 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
              {hasTrackedGrowth ? (
                <>
                  Since you started tracking, the market has added{' '}
                  <span className="font-semibold tabular-nums text-foreground">
                    {money(growth.total)}
                  </span>{' '}
                  — separate from anything you put in yourself.
                  {growth.missingCount > 0
                    ? ` (${growth.missingCount} update${growth.missingCount === 1 ? '' : 's'} didn't have enough detail to include here.)`
                    : ''}
                </>
              ) : (
                'Update your balances below to start separating what you put in from what the market adds.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {ownerOptions.map((opt) => (
              <FilterPill key={opt.value} active={ownerFilter === opt.value} onClick={() => setOwnerFilter(opt.value)}>
                {opt.label}
              </FilterPill>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            {POT_FILTERS.map((p) => (
              <FilterPill key={p.value} active={potFilter === p.value} onClick={() => setPotFilter(p.value)}>
                {p.label}
              </FilterPill>
            ))}
          </div>

          {updating ? (
            <UpdateBalances
              accounts={accounts}
              snapshots={snapshots}
              onSaved={async () => {
                setUpdating(false)
                await refetchAll()
              }}
              onCancel={() => setUpdating(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setUpdating(true)}
              className="rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-95"
            >
              Update balances
            </button>
          )}

          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold tracking-tight">Update history</h2>
              <div className="flex gap-1">
                <FilterPill active={view === 'monthly'} onClick={() => setView('monthly')}>
                  Monthly
                </FilterPill>
                <FilterPill active={view === 'annual'} onClick={() => setView('annual')}>
                  Annual
                </FilterPill>
              </div>
            </div>

            {snapshotsLoading ? (
              <p className="mt-4 text-[13px] text-muted-foreground">Loading…</p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {filteredAccounts.map((account) => {
                  const accountSnapshots = filteredSnapshots.filter((s) => s.accountId === account.id)
                  const periods: HistoryPeriod[] =
                    view === 'monthly'
                      ? accountSnapshots.map((s) => ({ ...s, label: monthYear(s.year, s.month) }))
                      : rollupSnapshotsByYear(accountSnapshots).map((r) => ({
                          ...r,
                          month: 1, // one row per year — month is unused beyond sorting/display
                          label: String(r.year),
                        }))
                  return (
                    <AccountHistoryCard
                      key={account.id}
                      provider={account.provider}
                      potCategory={account.potCategory}
                      periods={periods}
                    />
                  )
                })}
              </div>
            )}
          </section>

          <GrowthDiary entries={filteredSnapshots} accounts={filteredAccounts} />

          <div className="rounded-3xl bg-card p-7 shadow-soft">
            <HowWeWorkedThisOut>
              <Working
                formula="Market growth for a period = end balance − start balance − money in + money out."
                numbers="never a raw balance difference — a withdrawal is never mistaken for a market loss, and a contribution is never mistaken for growth."
              />
              <p>
                Every update you skip stays skipped — there's no assumed monthly
                cadence, and no missed-update reminder.
              </p>
            </HowWeWorkedThisOut>
          </div>
        </>
      )}
    </div>
  )
}
