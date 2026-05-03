import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/shared-with-me")({
  component: RouteComponent,
});

function RouteComponent() {
  return <Navigate to="/vaults" replace />;
}
