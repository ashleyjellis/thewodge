import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app/')({
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/app/dashboard', search })
  },
})
