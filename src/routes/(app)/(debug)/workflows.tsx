import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/(debug)/workflows")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/(app)/(debug)/workflows"!</div>;
}
