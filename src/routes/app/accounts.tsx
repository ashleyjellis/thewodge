/**
 * The Accounts tab (spec §2) — see AccountsSetup for the actual content;
 * this file is just the route/SEO wrapper.
 */
import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { surfaceSeo } from '@/lib/surfaceSeo'
import { AccountsSetup } from '@/components/app/AccountsSetup'

const accountsSeo = surfaceSeo('app', {
  title: `Accounts — ${SITE_NAME}`,
  description: 'Set up the real accounts that make up your wealth.',
  path: '/app/accounts',
})

export const Route = createFileRoute('/app/accounts')({
  head: () => ({
    links: accountsSeo.links,
    meta: accountsSeo.meta,
  }),
  component: AccountsSetup,
})
