import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AppShellSkeleton } from "~/components/app-shell-skeleton";
import { LinkCard } from "~/components/link-card";
import { Badge } from "~/components/ui/badge";
import { VaultIdentity } from "~/components/vault-identity";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import { Link2Off, Lock } from "lucide-react";
import * as React from "react";

export const Route = createFileRoute("/public_/$token")({
  component: PublicVaultRoute,
});

type PublicShare = {
  share: {
    _id: Id<"shares">;
    token: string;
  };
  vault: {
    name?: string;
    color?: string | null;
    emoji?: string;
  } | null;
  sharer?: {
    email?: string | null;
    name?: string | null;
  } | null;
};

type PublicLink = {
  _id: string;
  title: string;
  url: string;
  description?: string;
  image?: string;
  favicon?: string;
  category: string;
  enrichment_status: "pending" | "ready" | "error";
  addedByName?: string | null;
  viewers?: Array<{ userId: string; name: string | null; avatar: string | null }>;
  pinnedAt?: number | null;
};

function PublicVaultRoute() {
  const { token } = Route.useParams();
  const [activeCategory, setActiveCategory] = React.useState("All");

  const {
    data: shareData,
    isLoading: isShareLoading,
    isError: isShareError,
  } = useQuery({
    retry: 1,
    ...convexQuery(api.shares.getByToken, { token }),
  });
  const { data: links, isLoading: isLinksLoading } = useQuery(
    convexQuery(api.sharedVaultLinks.list, {
      token,
      query: undefined,
    })
  );

  if (isShareLoading || isLinksLoading) {
    return <AppShellSkeleton />;
  }

  if (isShareError || !shareData) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <Lock className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Public link unavailable</p>
        <p className="text-sm text-muted-foreground">
          This vault is private now, or the public link was rotated.
        </p>
      </div>
    );
  }

  const publicShare = shareData as PublicShare;
  const typedLinks = (links ?? []) as PublicLink[];
  const categories = [
    "All",
    ...Array.from(new Set(typedLinks.map((link) => link.category))).sort(),
  ];
  const filteredLinks =
    activeCategory === "All"
      ? typedLinks
      : typedLinks.filter((link) => link.category === activeCategory);
  const vaultColor = publicShare.vault?.color ?? "#6b7280";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
        <div
          className="h-28"
          style={{
            background: `linear-gradient(135deg, ${vaultColor}44, transparent)`,
          }}
        />
        <div className="px-6 pb-6">
          <div className="-mt-8 flex flex-wrap items-end gap-3">
            <div className="flex size-16 items-center justify-center rounded-2xl border-2 border-background bg-background/80 text-3xl shadow-sm backdrop-blur-sm">
              <VaultIdentity emoji={publicShare.vault?.emoji} size="md" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold">
                  {publicShare.vault?.name ?? "Public vault"}
                </h1>
                <Badge variant="secondary">View only</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Shared publicly by{" "}
                {publicShare.sharer?.email ??
                  publicShare.sharer?.name ??
                  "the owner"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {typedLinks.length > 0 ? (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeCategory === category
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      ) : null}

      {filteredLinks.length ? (
        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLinks.map((link) => (
            <LinkCard
              key={link._id}
              title={link.title}
              url={link.url}
              description={link.description}
              image={link.image}
              favicon={link.favicon}
              category={link.category}
              sharedBy={link.addedByName ?? undefined}
              isEnriching={link.enrichment_status === "pending"}
              viewers={link.viewers}
              isPinned={Boolean(link.pinnedAt)}
            />
          ))}
        </div>
      ) : (
        <div className="mx-auto flex w-full flex-1 flex-col items-center justify-center gap-3 text-center">
          <Link2Off className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No links in this public vault yet.
          </p>
        </div>
      )}
    </div>
  );
}
