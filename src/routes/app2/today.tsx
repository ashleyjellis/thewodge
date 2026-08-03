/**
 * Today — the check-in screen, currently the Dashboard's own content
 * (DashboardBody). Gains its own bespoke behaviours — the ambient crossover
 * subtitle, the Today-if sandbox, movement moments, down-market
 * reassurance — in later phases.
 */
import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { DashboardBody } from '@/components/app/DashboardBody'

const todaySeo = seo({
  title: `Today — ${SITE_NAME}`,
  description: 'Your household, at a glance.',
  path: '/app2/today',
})

export const Route = createFileRoute('/app2/today')({
  head: () => ({
    links: todaySeo.links,
    meta: [...todaySeo.meta, { name: 'robots', content: 'noindex' }],
  }),
  component: () => <DashboardBody accountsPath="/app2/accounts" />,
})
