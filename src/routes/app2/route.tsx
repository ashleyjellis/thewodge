import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AppShell } from '@/components/app/AppShell'

const TABS = [
  { to: '/app2/today', label: 'Today' },
  { to: '/app2/plan', label: 'Plan' },
  { to: '/app2/accounts', label: 'Accounts' },
]

export const Route = createFileRoute('/app2')({
  // Spreads the incoming search through rather than replacing it outright —
  // child routes under /app2 validate their own search keys too (e.g.
  // today.tsx's justChanged), and each level's validateSearch only ever
  // receives what the previous level returned, not the raw URL. Returning
  // a bare { from } here would silently strip every other key before any
  // child route ever saw it.
  validateSearch: (search: Record<string, unknown>): { from?: string } & Record<string, unknown> => ({
    ...search,
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
