import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { HistoryLoadingState } from "~/components/page-skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import { useAuth } from "~/hooks/use-auth";
import { ArrowLeft, History } from "lucide-react";

export const Route = createFileRoute("/my-vaults_/$vaultId/history")({
  component: RouteComponent,
});

type HistoryEvent = {
  id: string;
  type: string;
  humanType: string;
  summary: string;
  by: string;
  byUserId: string;
  byAvatar: string | null;
  at: number;
};

function RouteComponent() {
  const auth = useAuth();
  const { vaultId } = Route.useParams();
  const typedVaultId = vaultId as Id<"vaults">;
  const { data, isPending } = useQuery({
    enabled: auth.canQueryProtected,
    ...convexQuery(api.history.listForVault, {
      vaultId: typedVaultId,
    }),
  });
  const typedHistory = (data ?? []) as HistoryEvent[];
  const currentUserId = auth.user?._id as string | undefined;

  if (
    auth.isLoading ||
    (auth.authenticated && !auth.canQueryProtected) ||
    isPending
  ) {
    return <HistoryLoadingState />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={
            <Link to="/my-vaults/$vaultId" params={{ vaultId }} preload="intent">
              <ArrowLeft className="size-4" />
            </Link>
          }
        />
        <h2 className="text-lg font-medium">Vault history</h2>
      </div>

      {typedHistory.length ? (
        <div className="space-y-1">
          {typedHistory.map((event) => {
            const isMe = currentUserId === event.byUserId;
            return (
              <div
                key={event.id}
                className="hover:bg-accent/40 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
              >
                <Avatar size="sm" className="shrink-0">
                  <AvatarImage src={event.byAvatar ?? undefined} />
                  <AvatarFallback>
                    {isMe
                      ? "Y"
                      : (event.by?.charAt(0)?.toUpperCase() ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{event.summary}</p>
                  <p className="text-muted-foreground text-xs">
                    {isMe ? "You" : event.by} &middot;{" "}
                    {new Date(event.at).toLocaleString()}
                  </p>
                </div>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {event.humanType}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mx-auto flex flex-1 w-full flex-col items-center justify-center gap-3 text-center">
          <History className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">
            No history yet for this vault.
          </p>
        </div>
      )}
    </div>
  );
}
