import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LinkCard } from "~/components/link-card";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import { useAuth } from "~/hooks/use-auth";
import { Link2Off } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/shared_/$shareToken/")({
  component: RouteComponent,
});

type LinkViewer = {
  userId: string;
  name: string | null;
  avatar: string | null;
};

type SharedLink = {
  _id: string;
  title: string;
  url: string;
  description?: string;
  image?: string;
  favicon?: string;
  category: string;
  enrichment_status: string;
  addedByName?: string;
  viewers?: LinkViewer[];
};

function RouteComponent() {
  const auth = useAuth();
  const { shareToken } = Route.useParams();
  const [activeCategory, setActiveCategory] = React.useState<string>("All");

  const { data: shareData } = useQuery(
    convexQuery(api.shares.getByToken, { token: shareToken })
  );
  const { data: links, isLoading: isLinksLoading } = useQuery(
    convexQuery(api.sharedVaultLinks.list, {
      token: shareToken,
      query: undefined,
    })
  );

  const { mutate: addToShare } = useMutation({
    mutationFn: useConvexMutation(api.sharedVaultLinks.add),
  });

  const { mutate: recordView } = useMutation({
    mutationFn: useConvexMutation(api.links.recordView),
  });

  const canEdit =
    auth.canQueryProtected && shareData?.share && shareData?.canEdit;

  React.useEffect(() => {
    if (!canEdit || !shareData?.share) return;

    function onPaste(e: ClipboardEvent) {
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      )
        return;
      if (active instanceof HTMLElement && active.isContentEditable) return;

      const hasOpenOverlay = document.querySelector(
        "[role='dialog'][data-open], [data-slot='dialog-content'][data-open], [data-slot='alert-dialog-content'][data-open], [data-slot='popover-content'][data-open]"
      );
      if (hasOpenOverlay) return;

      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (!text) return;

      try {
        new URL(text);
      } catch {
        return;
      }

      e.preventDefault();
      addToShare(
        { shareId: shareData!.share._id, url: text },
        {
          onSuccess: () => {
            toast.success("Link added from clipboard");
          },
          onError: (err: Error) => {
            toast.error(err.message);
          },
        }
      );
    }

    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("paste", onPaste);
    };
  }, [addToShare, canEdit, shareData]);

  const typedLinks = (links ?? []) as SharedLink[];

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const link of typedLinks) {
      if (link.category) set.add(link.category);
    }
    return ["All", ...Array.from(set).sort()];
  }, [typedLinks]);

  const filteredLinks =
    activeCategory === "All"
      ? typedLinks
      : typedLinks.filter((l) => l.category === activeCategory);

  const hasLinks = filteredLinks.length > 0;

  return (
    <div className="space-y-6">
      {typedLinks.length > 0 ? (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setActiveCategory(cat);
              }}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      ) : null}

      {isLinksLoading ? (
        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`shared-link-skeleton-${index}`}
              className="h-44 animate-pulse rounded-xl bg-muted/30"
            />
          ))}
        </div>
      ) : hasLinks ? (
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
              sharedBy={link.addedByName}
              isEnriching={link.enrichment_status === "pending"}
              viewers={link.viewers}
              onNavigate={() => {
                if (auth.canQueryProtected) {
                  recordView({ linkId: link._id as Id<"links"> });
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div className="mx-auto flex w-full flex-1 flex-col items-center justify-center gap-3 text-center">
          <Link2Off className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {activeCategory !== "All"
              ? `No ${activeCategory} links`
              : "No links in this shared vault yet."}
          </p>
          {activeCategory === "All" && !canEdit ? (
            <p className="max-w-sm text-xs text-muted-foreground/90">
              You have view-only access. Links will appear here when the owner
              or an editor adds them.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
