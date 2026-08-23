/**
 * The Dashboard tab — the household's home screen. See DashboardBody for
 * the actual content; this file is just the route/SEO wrapper.
 */
import { createFileRoute } from '@tanstack/react-router'
import { SITE_NAME } from '@/config'
import { surfaceSeo } from '@/lib/surfaceSeo'
import { DashboardBody } from '@/components/app/DashboardBody'

const dashboardSeo = surfaceSeo('app', {
  title: `Dashboard — ${SITE_NAME}`,
  description: 'Your household, at a glance.',
  path: '/app/dashboard',
})

export const Route = createFileRoute('/app/dashboard')({
  head: () => ({
    links: dashboardSeo.links,
    meta: dashboardSeo.meta,
  }),
  component: () => <DashboardBody accountsPath="/app/accounts" />,
})
