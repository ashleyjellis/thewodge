/**
 * Accounts — the ledger, the full plan history timeline, and the merged
 * financial diary.
 */
import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { useHousehold } from '@/state/useHousehold'
import { useAccounts } from '@/state/useAccounts'
import { useSnapshots } from '@/state/useSnapshots'
import { usePlan } from '@/state/usePlan'
import { useCheckpoints } from '@/state/useCheckpoints'
import { buildFinancialDiary } from '@/lib/diary'
import { AccountsSetup } from '@/components/app/AccountsSetup'
import { CheckpointTimeline } from '@/components/app/CheckpointTimeline'
import { FinancialDiary } from '@/components/app/FinancialDiary'

const accountsSeo = seo({
  title: `Accounts — ${SITE_NAME}`,
  description: 'Set up the real accounts that make up your wealth.',
  path: '/app2/accounts',
})

export const Route = createFileRoute('/app2/accounts')({
  head: () => ({
    links: accountsSeo.links,
    meta: [...accountsSeo.meta, { name: 'robots', content: 'noindex' }],
  }),
  component: Accounts,
})

function Accounts() {
  const { household, people } = useHousehold()
  const { accounts } = useAccounts(household?.id ?? null)
  const { snapshots } = useSnapshots(household?.id ?? null)
  const { contributionChanges, plannedEvents } = usePlan(household?.id ?? null)
  const { history } = useCheckpoints(household?.id ?? null)

  const diaryEntries = buildFinancialDiary({
    snapshots,
    contributionChanges,
    plannedEvents,
    checkpoints: history,
  })

  return (
    <div className="space-y-10">
      <AccountsSetup />
      <CheckpointTimeline history={history} />
      <FinancialDiary entries={diaryEntries} accounts={accounts} people={people} />
    </div>
  )
}
