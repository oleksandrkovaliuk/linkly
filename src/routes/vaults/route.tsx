import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { AppShellSkeleton } from "~/components/app-shell-skeleton";
import { CreateVaultDialog } from "~/components/create-vault-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { SignInToContinue } from "~/components/sign-in-to-continue";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import { useAuth } from "~/hooks/use-auth";
import { Check, FolderOpenDot, Inbox, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/vaults")({
  beforeLoad: ({ context }) => {
    if (context.auth?.authResolved && !context.auth.authenticated) {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: VaultsRoute,
});

type VaultListItem = {
  _id: Id<"vaults">;
  name: string;
  color?: string | null;
  emoji?: string;
  vaultType?: "owned" | "shared";
  accessRole?: "owner" | "contributor" | "viewer";
  linkCount?: number;
  topCategories?: string[];
};

type PendingInvite = {
  invite: {
    _id: Id<"share_invites">;
    token?: string;
    role: "viewer" | "editor" | "contributor";
  };
  vault: {
    name?: string;
    color?: string | null;
    emoji?: string;
  } | null;
  inviter: {
    email?: string | null;
    name?: string | null;
  } | null;
};

function VaultsRoute() {
  const auth = useAuth();
  const queryClient = useQueryClient();

  const { data: vaults, isLoading: isVaultsLoading } = useQuery({
    enabled: auth.canQueryProtected,
    ...convexQuery(api.vaults.listMine, {}),
  });
  const { data: pendingInvites, isLoading: isInvitesLoading } = useQuery({
    enabled: auth.canQueryProtected,
    ...convexQuery(api.shares.listPendingInvites, {}),
  });

  const { mutate: acceptInvite, isPending: isAccepting } = useMutation({
    mutationFn: useConvexMutation(api.shares.acceptInvite),
  });
  const { mutate: declineInvite, isPending: isDeclining } = useMutation({
    mutationFn: useConvexMutation(api.shares.declineInvite),
  });

  if (!auth.authenticated && auth.authResolved) {
    return (
      <SignInToContinue
        title="Sign in to view vaults"
        description="Owned vaults, shared vaults, and invitations live here."
      />
    );
  }

  if (!auth.canQueryProtected || isVaultsLoading || isInvitesLoading) {
    return <AppShellSkeleton />;
  }

  const typedVaults = (vaults ?? []) as VaultListItem[];
  const typedInvites = (pendingInvites ?? []) as PendingInvite[];

  function refreshVaultHub() {
    void queryClient.invalidateQueries(convexQuery(api.vaults.listMine, {}));
    void queryClient.invalidateQueries(
      convexQuery(api.shares.listPendingInvites, {})
    );
    void queryClient.invalidateQueries(
      convexQuery(api.shares.pendingInviteCount, {})
    );
  }

  function handleAccept(token?: string) {
    if (!token) return;
    acceptInvite(
      { token },
      {
        onSuccess: () => {
          refreshVaultHub();
          toast.success("Invitation accepted");
        },
        onError: (error) => toast.error(error.message),
      }
    );
  }

  function handleDecline(token?: string) {
    if (!token) return;
    declineInvite(
      { token },
      {
        onSuccess: () => {
          refreshVaultHub();
          toast.success("Invitation declined");
        },
        onError: (error) => toast.error(error.message),
      }
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Badge variant="outline" className="bg-background/60">
            Vault hub
          </Badge>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Vaults</h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              One place for your vaults, shared workspaces, and invitations
              waiting on a decision.
            </p>
          </div>
        </div>
        <CreateVaultDialog />
      </div>

      {typedInvites.length ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Inbox className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">Inbox</h2>
            <Badge variant="secondary">{typedInvites.length}</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {typedInvites.map((item) => (
              <Card
                key={item.invite._id}
                className="relative overflow-hidden border-amber-500/20 bg-amber-500/[0.03]"
              >
                <div className="absolute inset-y-0 left-0 w-1 bg-amber-400" />
                <div className="flex items-start gap-3 px-4">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl text-lg"
                    style={{
                      backgroundColor: `${item.vault?.color ?? "#f59e0b"}20`,
                    }}
                  >
                    {item.vault?.emoji ?? "📁"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.vault?.name ?? "Shared vault"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Invited by{" "}
                      {item.inviter?.email ?? item.inviter?.name ?? "someone"}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        loading={isAccepting}
                        onClick={() => handleAccept(item.invite.token)}
                      >
                        <Check className="size-3.5" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={isDeclining}
                        onClick={() => handleDecline(item.invite.token)}
                      >
                        <X className="size-3.5" />
                        Decline
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">All vaults</h2>
          <Badge variant="secondary">{typedVaults.length}</Badge>
        </div>

        {typedVaults.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {typedVaults.map((vault) => (
              <Link
                key={vault._id}
                to="/vaults/$vaultId"
                params={{ vaultId: vault._id }}
                preload="intent"
                className="group outline-none"
              >
                <Card className="relative h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div
                    className="absolute inset-x-0 top-0 h-16 opacity-70"
                    style={{
                      background: `linear-gradient(135deg, ${
                        vault.color ?? "#6b7280"
                      }33, transparent)`,
                    }}
                  />
                  <div className="relative flex items-start gap-3 px-4">
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl text-lg ring-1 ring-border/50"
                      style={{
                        backgroundColor: `${vault.color ?? "#6b7280"}20`,
                      }}
                    >
                      {vault.emoji ?? "📁"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {vault.name}
                        </p>
                        <Badge
                          variant={
                            vault.vaultType === "shared"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {vault.vaultType === "shared" ? "Shared" : "Owned"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {vault.linkCount ?? 0} links
                      </p>
                      {vault.topCategories?.length ? (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {vault.topCategories.map((category) => (
                            <Badge key={category} variant="outline">
                              {category}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
              <FolderOpenDot className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">No vaults yet</p>
              <p className="text-sm text-muted-foreground">
                Create a vault or accept an invitation to get started.
              </p>
            </div>
            <CreateVaultDialog />
          </div>
        )}
      </section>
    </div>
  );
}
