import { createFileRoute, Link } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import { useAuth } from "~/hooks/use-auth";
import { AppShellSkeleton } from "~/components/app-shell-skeleton";
import { SignInToContinue } from "~/components/sign-in-to-continue";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { VaultIdentity } from "~/components/vault-identity";
import { ChevronRight, Inbox } from "lucide-react";

export const Route = createFileRoute("/history")({
  component: RouteComponent,
});

type InboxEvent = {
  id: string;
  type: string;
  humanType: string;
  summary: string;
  by: string;
  byUserId: string;
  byAvatar: string | null;
  at: number;
  vaultId: string;
  vaultName: string;
  vaultColor: string | null;
  vaultEmoji: string | null;
};

function groupByVault(
  events: InboxEvent[],
): [
  string,
  {
    name: string;
    color: string | null;
    emoji: string | null;
    events: InboxEvent[];
  },
][] {
  const map = new Map<
    string,
    {
      name: string;
      color: string | null;
      emoji: string | null;
      events: InboxEvent[];
    }
  >();
  for (const event of events) {
    let group = map.get(event.vaultId);
    if (!group) {
      group = {
        name: event.vaultName,
        color: event.vaultColor,
        emoji: event.vaultEmoji,
        events: [],
      };
      map.set(event.vaultId, group);
    }
    group.events.push(event);
  }
  return [...map.entries()].sort((a, b) => {
    const latestA = a[1].events[0]?.at ?? 0;
    const latestB = b[1].events[0]?.at ?? 0;
    return latestB - latestA;
  });
}

function RouteComponent() {
  const auth = useAuth();
  const { data, isPending } = useQuery({
    enabled: auth.canQueryProtected,
    ...convexQuery(api.history.listInbox, {}),
  });

  if (!auth.authenticated && auth.authResolved) {
    return (
      <SignInToContinue
        title="Sign in to open Inbox"
        description="Activity from shared vaults appears here when you’re signed in."
      />
    );
  }

  if (!auth.canQueryProtected) {
    return null;
  }

  if (isPending) {
    return <AppShellSkeleton />;
  }

  const typedData = (data ?? []) as InboxEvent[];
  const grouped = groupByVault(typedData);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <h1 className="text-lg font-medium">Inbox</h1>

      {grouped.length ? (
        grouped.map(([vaultId, group]) => (
          <section key={vaultId} className="space-y-1">
            <Link
              to="/vaults/$vaultId"
              params={{ vaultId: vaultId as Id<"vaults"> }}
              preload="intent"
              className="hover:bg-accent/40 group flex items-center gap-2 rounded-xl px-3 py-1.5 transition-colors"
            >
              <VaultIdentity emoji={group.emoji ?? undefined} />
              <span className="text-sm font-medium">{group.name}</span>
              <ChevronRight className="text-muted-foreground ml-auto size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>

            <div className="space-y-1">
              {group.events.map((event) => (
                <div
                  key={event.id}
                  className="hover:bg-accent/40 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
                >
                  <Avatar size="sm" className="shrink-0">
                    <AvatarImage src={event.byAvatar ?? undefined} />
                    <AvatarFallback>
                      {event.by?.charAt(0)?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{event.summary}</p>
                    <p className="text-muted-foreground text-xs">
                      {event.by} &middot;{" "}
                      {new Date(event.at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {event.humanType}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="mx-auto flex w-full flex-col items-center justify-center gap-3 py-12 text-center">
          <Inbox className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">
            No updates yet. Activity from others will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
