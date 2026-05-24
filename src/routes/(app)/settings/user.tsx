import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/settings/user')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(app)/settings/user"!</div>
}
