/**
 * Today — the check-in screen, currently the Dashboard's own content
 * (DashboardBody) plus the Today-if sandbox. Gains its own bespoke
 * behaviours — the ambient crossover subtitle, movement moments,
 * down-market reassurance — in later phases.
 */
import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { seo } from '@/lib/seo'
import { DashboardBody } from '@/components/app/DashboardBody'
import { TodayIfSandbox } from '@/components/app/TodayIfSandbox'

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
  component: Today,
})

function Today() {
  return (
    <div className="space-y-10">
      <DashboardBody accountsPath="/app2/accounts" />
      <TodayIfSandbox />
    </div>
  )
}
