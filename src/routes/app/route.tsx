import { createFileRoute, Outlet } from '@tanstack/react-router'
import { HouseholdProvider } from '@/state/household'

export const Route = createFileRoute('/app')({
  component: AppLayout,
})

function AppLayout() {
  return (
    <HouseholdProvider>
      <Outlet />
    </HouseholdProvider>
  )
}
