import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderOpenDot } from "lucide-react";
import { AppShellSkeleton } from "~/components/app-shell-skeleton";
import { SignInToContinue } from "~/components/sign-in-to-continue";
import { api } from "~/convex/_generated/api";
import { useAuth } from "~/hooks/use-auth";

export const Route = createFileRoute("/shared-with-me")({
  component: RouteComponent,
});

function RouteComponent() {
  const auth = useAuth();
  const { data, isPending } = useQuery({
    enabled: auth.canQueryProtected,
    ...convexQuery(api.shares.listReceived, {}),
  });

  if (!auth.authenticated && auth.authResolved) {
    return (
      <SignInToContinue
        title="Sign in to see shared vaults"
        description="Vaults others share with you will show up here."
      />
    );
  }

  if (!auth.canQueryProtected) {
    return null;
  }

  if (isPending) {
    return <AppShellSkeleton />;
  }

  if (!data?.length) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <FolderOpenDot className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No shared vaults yet. Ask a teammate to share a vault with you.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <h1 className="text-lg font-medium">Shared with me</h1>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.map((item) => (
          <Link
            key={item.share._id}
            to="/shared/$shareToken"
            preload="intent"
            params={{ shareToken: item.share.token }}
            className="group flex items-center gap-3 rounded-xl p-3 text-left ring-1 ring-border/50 transition-all hover:ring-border hover:shadow-sm"
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-base leading-none"
              style={{
                backgroundColor: `${item.vault?.color ?? "#6b7280"}20`,
              }}
            >
              {item.vault?.emoji ?? "📁"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {item.vault?.name ?? "Shared vault"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                by{" "}
                {item.sharer?.email ?? item.sharer?.name ?? "Unknown"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
