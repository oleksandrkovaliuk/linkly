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
import { ArrowRight, History, Sparkles } from "lucide-react";

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

type HistoryEvent = {
  id: string;
  humanType: string;
  summary: string;
  vaultId: string;
};

function RouteComponent() {
  const auth = useAuth();

  const { data: recents, isLoading: isRecentsLoading } = useQuery({
    enabled: auth.canQueryProtected,
    ...convexQuery(api.vaults.listRecent, {}),
  });
  const { data: history } = useQuery({
    enabled: auth.canQueryProtected,
    ...convexQuery(api.history.listGlobal, {}),
  });

  if (auth.authenticated && !auth.canQueryProtected) {
    return <AppShellSkeleton />;
  }

  if (auth.authenticated && auth.canQueryProtected) {
    const typedRecents = (recents ?? []) as RecentVault[];
    const typedHistory = (history ?? []) as HistoryEvent[];
    const latestHistoryByVault = new Map<string, HistoryEvent>();
    for (const event of typedHistory) {
      if (!latestHistoryByVault.has(event.vaultId)) {
        latestHistoryByVault.set(event.vaultId, event);
      }
    }

    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-7 p-6">
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-background/60">
              Dashboard
            </Badge>
          </div>
          <div className="space-y-1.5">
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance">
              Pick up where the vaults are warm.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
              Recent vaults, the latest activity inside them, and a clear jump
              back into the work.
            </p>
          </div>
        </section>

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
                  className="h-40 animate-pulse rounded-2xl bg-muted/40"
                />
              ))}
            </div>
          ) : typedRecents.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {typedRecents.map((vault) => {
                const event = latestHistoryByVault.get(vault._id as string);
                return (
                  <Card
                    key={vault._id}
                    className="relative h-full overflow-hidden p-0 transition-shadow hover:shadow-md"
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-20 opacity-80"
                      style={{
                        background: `linear-gradient(135deg, ${
                          vault.color ?? "#6b7280"
                        }2e, transparent)`,
                      }}
                    />
                    <div className="relative flex h-full flex-col gap-4 p-4">
                      <div className="flex items-start gap-3">
                        <span
                          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-lg shadow-sm ring-1 ring-black/[0.04]"
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
                            <Badge variant="secondary">
                              {vault.accessRole === "owner"
                                ? "Owned"
                                : "Shared"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {vault.recent?.last_action?.replace(/_/g, " ") ??
                              "recently active"}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl bg-background/70 p-3 shadow-sm ring-1 ring-black/[0.04]">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                          <History className="size-3.5" />
                          Snapshot
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed">
                          {event?.summary ?? "No visible history yet."}
                        </p>
                        {event ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {event.humanType}
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-auto flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          nativeButton={false}
                          render={
                            <Link
                              to="/vaults/$vaultId"
                              params={{ vaultId: vault._id }}
                              preload="intent"
                            >
                              Open
                              <ArrowRight className="size-3.5" />
                            </Link>
                          }
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          nativeButton={false}
                          render={
                            <Link
                              to="/vaults/$vaultId/history"
                              params={{ vaultId: vault._id }}
                              preload="intent"
                            >
                              History
                            </Link>
                          }
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="px-4">
              <p className="text-sm font-medium">No recent vault activity</p>
              <p className="text-sm text-muted-foreground">
                Open a vault, add a link, or accept an invite to populate this
                space.
              </p>
              <div className="pt-1">
                <CreateVaultDialog />
              </div>
            </Card>
          )}
        </section>
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
