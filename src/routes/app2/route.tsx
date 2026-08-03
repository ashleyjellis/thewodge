import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AppShell } from '@/components/app/AppShell'

const TABS = [
  { to: '/app2/today', label: 'Today' },
  { to: '/app2/plan', label: 'Plan' },
  { to: '/app2/accounts', label: 'Accounts' },
]

export const Route = createFileRoute('/app2')({
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
  component: App2Layout,
})

function App2Layout() {
  const { from } = Route.useSearch()
  return (
    <AppShell fromHook={from} tabs={TABS}>
      <Outlet />
    </AppShell>
  )
}
