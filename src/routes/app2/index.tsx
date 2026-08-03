import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app2/')({
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/app2/today', search })
  },
})
