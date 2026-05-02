import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShellSkeleton } from "~/components/app-shell-skeleton";
import { CreateVaultDialog } from "~/components/create-vault-dialog";
import { LoginDialog } from "~/components/login-dialog/login-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { DialogTrigger } from "~/components/ui/dialog";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import { useAuth } from "~/hooks/use-auth";
import { ArrowRight, Inbox, Plus, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

type RecentVault = {
  _id: Id<"vaults">;
  name: string;
  color?: string | null;
  emoji?: string;
  accessRole?: "owner" | "contributor" | "viewer";
  recent?: {
    last_active_at: number;
    last_action: string;
  };
};

type PendingInvite = {
  invite: { _id: Id<"share_invites"> };
  vault: { name?: string; color?: string | null; emoji?: string } | null;
  inviter: { email?: string | null; name?: string | null } | null;
};

function RouteComponent() {
  const auth = useAuth();

  const { data: recents, isLoading: isRecentsLoading } = useQuery({
    enabled: auth.canQueryProtected,
    ...convexQuery(api.vaults.listRecent, {}),
  });
  const { data: pendingInvites, isLoading: isInvitesLoading } = useQuery({
    enabled: auth.canQueryProtected,
    ...convexQuery(api.shares.listPendingInvites, {}),
  });

  if (auth.authenticated && !auth.canQueryProtected) {
    return <AppShellSkeleton />;
  }

  if (auth.authenticated && auth.canQueryProtected) {
    const typedRecents = (recents ?? []) as RecentVault[];
    const typedInvites = (pendingInvites ?? []) as PendingInvite[];

    return (
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6">
        <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="absolute -right-20 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-3">
              <Badge variant="outline" className="bg-background/60">
                Dashboard
              </Badge>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                  Pick up where the vaults are warm.
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Recent collaboration, pending invitations, and fast vault
                  actions live together here.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <CreateVaultDialog
                trigger={
                  <Button>
                    <Plus className="size-4" />
                    New vault
                  </Button>
                }
              />
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link to="/vaults">View all</Link>}
              />
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">Latest activity</h2>
            </div>
            {isRecentsLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-32 animate-pulse rounded-2xl bg-muted/40"
                  />
                ))}
              </div>
            ) : typedRecents.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {typedRecents.map((vault) => (
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
                          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-lg"
                          style={{
                            backgroundColor: `${vault.color ?? "#6b7280"}20`,
                          }}
                        >
                          {vault.emoji ?? "📁"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {vault.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {vault.recent?.last_action?.replace(/_/g, " ") ??
                              "recently active"}
                          </p>
                        </div>
                        <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card className="px-4">
                <p className="text-sm font-medium">No recent vault activity</p>
                <p className="text-sm text-muted-foreground">
                  Open a vault, add a link, or accept an invite to populate this
                  space.
                </p>
              </Card>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Inbox className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">Inbox preview</h2>
              {typedInvites.length ? (
                <Badge variant="secondary">{typedInvites.length}</Badge>
              ) : null}
            </div>
            <Card className="px-4">
              {isInvitesLoading ? (
                <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
              ) : typedInvites.length ? (
                <div className="space-y-3">
                  {typedInvites.slice(0, 3).map((item) => (
                    <div key={item.invite._id} className="flex items-center gap-3">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-xl text-base"
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
                        <p className="truncate text-xs text-muted-foreground">
                          {item.inviter?.email ??
                            item.inviter?.name ??
                            "Invitation waiting"}
                        </p>
                      </div>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link to="/vaults">View all</Link>}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Inbox is clear</p>
                  <p className="text-sm text-muted-foreground">
                    Pending vault invitations will show up here.
                  </p>
                </div>
              )}
            </Card>
          </section>
        </div>
      </div>
    );
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
