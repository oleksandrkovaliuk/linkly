import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "~/hooks/use-auth";

import { LoginDialog } from "~/components/login-dialog/login-dialog";
import { Button } from "~/components/ui/button";
import { DialogTrigger } from "~/components/ui/dialog";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const auth = useAuth();

  if (auth.authenticated && auth.canQueryProtected) {
    return <Navigate to="/my-vaults" replace />;
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          Link Vault
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          Your links, organized
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Sign in to create vaults, save links, and share with your team.
        </p>
      </div>
      <LoginDialog>
        <DialogTrigger
          render={
            <Button variant="default" size="lg" className="w-full max-w-xs">
              Sign in
            </Button>
          }
        />
      </LoginDialog>
    </div>
  );
}
