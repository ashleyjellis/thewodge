import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/performance/admin/')({
  component: () => <Navigate to="/performance/admin/entry" replace />,
})
