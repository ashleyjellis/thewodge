/**
 * Accounts — the ledger. Currently identical to /app's Accounts tab
 * (AccountsSetup); gains the checkpoint-history timeline and the financial
 * diary in later phases.
 */
import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { AccountsSetup } from '@/components/app/AccountsSetup'

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
  component: AccountsSetup,
})
