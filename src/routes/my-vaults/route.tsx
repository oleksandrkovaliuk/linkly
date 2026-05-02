import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/my-vaults")({
  component: RouteComponent,
});

function RouteComponent() {
  return <Navigate to="/vaults" replace />;
}
