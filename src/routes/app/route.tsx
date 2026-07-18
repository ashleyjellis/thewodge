import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AppShell } from '@/components/app/AppShell'

export const Route = createFileRoute('/app')({
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
  component: AppLayout,
})

function AppLayout() {
  const { from } = Route.useSearch()
  return (
    <AppShell fromHook={from}>
      <Outlet />
    </AppShell>
  )
}
