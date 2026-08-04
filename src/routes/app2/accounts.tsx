/**
 * Accounts — the ledger, plus the full plan history timeline. Gains the
 * financial diary in a later phase.
 */
import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { useHousehold } from '@/state/useHousehold'
import { useCheckpoints } from '@/state/useCheckpoints'
import { AccountsSetup } from '@/components/app/AccountsSetup'
import { CheckpointTimeline } from '@/components/app/CheckpointTimeline'

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
  const { household } = useHousehold()
  const { history } = useCheckpoints(household?.id ?? null)

  return (
    <div className="space-y-10">
      <AccountsSetup />
      <CheckpointTimeline history={history} />
    </div>
  )
}
