import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/shared_/$shareToken")({
  component: RouteComponent,
});

function RouteComponent() {
  const { shareToken } = Route.useParams();
  return <Navigate to="/public/$token" params={{ token: shareToken }} replace />;
}
