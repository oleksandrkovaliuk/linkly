import { createFileRoute } from "@tanstack/react-router";
import { LoginDialog } from "~/components/login-dialog/login-dialog";

export const Route = createFileRoute("/sso")({
  component: RouteComponent,
});

function RouteComponent() {
  return <LoginDialog defaultStep="sso" />;
}
