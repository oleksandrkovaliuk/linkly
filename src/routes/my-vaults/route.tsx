import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppShellSkeleton } from "~/components/app-shell-skeleton";
import { CreateVaultDialog } from "~/components/create-vault-dialog";
import { SignInToContinue } from "~/components/sign-in-to-continue";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import { useAuth } from "~/hooks/use-auth";
import { FolderPlus } from "lucide-react";

export const Route = createFileRoute("/my-vaults")({
  component: RouteComponent,
});

type VaultListItem = {
  _id: Id<"vaults">;
  name: string;
};

function RouteComponent() {
  const auth = useAuth();

  const { data: vaults, isLoading: isVaultsLoading } = useQuery({
    enabled: auth.canQueryProtected,
    ...convexQuery(api.vaults.listMine, {}),
  });

  const typedVaults = (vaults ?? []) as VaultListItem[];

  if (!auth.authenticated && auth.authResolved) {
    return (
      <SignInToContinue
        title="Sign in to view your vaults"
        description="Create and manage link vaults after you sign in."
      />
    );
  }

  if (!auth.canQueryProtected) {
    return null;
  }

  if (isVaultsLoading) {
    return <AppShellSkeleton />;
  }

  if (typedVaults.length > 0) {
    return (
      <Navigate
        to="/my-vaults/$vaultId"
        params={{ vaultId: typedVaults[0]._id }}
      />
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="bg-muted flex size-14 items-center justify-center rounded-2xl">
        <FolderPlus className="text-muted-foreground size-6" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">No vaults yet</p>
        <p className="text-muted-foreground text-sm">
          Create your first vault to start saving and organizing links.
        </p>
      </div>
      <CreateVaultDialog />
    </div>
  );
}
