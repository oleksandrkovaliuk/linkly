import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LinkCard } from "~/components/link-card";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import { useAuth } from "~/hooks/use-auth";
import { ClipboardPaste, Keyboard, Link2Off, Search } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

const isMac =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

export const Route = createFileRoute("/vaults_/$vaultId/")({
  component: VaultIndexRoute,
});

type LinkViewer = {
  userId: string;
  name: string | null;
  avatar: string | null;
};

type VaultLink = {
  _id: string;
  title: string;
  url: string;
  description?: string;
  image?: string;
  favicon?: string;
  category: string;
  enrichment_status: "pending" | "ready" | "error";
  addedByName?: string | null;
  viewers?: LinkViewer[];
  pinnedAt?: number | null;
};

function VaultIndexRoute() {
  const auth = useAuth();
  const { vaultId } = Route.useParams();
  const typedVaultId = vaultId as Id<"vaults">;
  const [activeCategory, setActiveCategory] = React.useState("All");

  const { data: links, isPending: isLinksPending } = useQuery({
    enabled: auth.canQueryProtected,
    ...convexQuery(api.links.search, {
      vaultId: typedVaultId,
      query: "",
    }),
  });

  const { mutate: addToVault } = useMutation({
    mutationFn: useConvexMutation(api.links.create),
  });
  const { mutate: recordView } = useMutation({
    mutationFn: useConvexMutation(api.links.recordView),
  });
  const { mutate: setPinned } = useMutation({
    mutationFn: useConvexMutation(api.links.setPinned),
  });

  React.useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      ) {
        return;
      }
      if (active instanceof HTMLElement && active.isContentEditable) return;

      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (!text) return;

      try {
        new URL(text);
      } catch {
        return;
      }

      e.preventDefault();
      addToVault(
        { vaultId: typedVaultId, url: text },
        {
          onSuccess: () => toast.success("Link added from clipboard"),
          onError: (error) => toast.error(error.message),
        }
      );
    }

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addToVault, typedVaultId]);

  const typedLinks = React.useMemo(
    () => (links ?? []) as VaultLink[],
    [links]
  );

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
      : typedLinks.filter((link) => link.category === activeCategory);

  const hasLinks = filteredLinks.length > 0;

  function togglePin(link: VaultLink) {
    setPinned(
      {
        vaultId: typedVaultId,
        linkId: link._id as Id<"links">,
        pinned: !link.pinnedAt,
      },
      {
        onError: (error) => toast.error(error.message),
      }
    );
  }

  return (
    <div className="space-y-6">
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

      {isLinksPending ? (
        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`vault-link-skeleton-${index}`}
              className="h-52 animate-pulse rounded-2xl bg-muted/30"
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
              sharedBy={link.addedByName ?? undefined}
              isEnriching={link.enrichment_status === "pending"}
              viewers={link.viewers}
              isPinned={Boolean(link.pinnedAt)}
              onTogglePin={() => togglePin(link)}
              onNavigate={() => recordView({ linkId: link._id as Id<"links"> })}
            />
          ))}
        </div>
      ) : activeCategory !== "All" ? (
        <div className="mx-auto flex w-full flex-1 flex-col items-center justify-center gap-3 text-center">
          <Link2Off className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No {activeCategory} links
          </p>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-5 py-20 text-center">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Add your first link</p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Copy any URL, then use one of these methods.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2">
            <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5 text-left">
              <Keyboard className="size-4 shrink-0 text-muted-foreground" />
              <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">
                Press{" "}
                <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground shadow-[0_1px_0_0] shadow-border">
                  {isMac ? "⌘" : "Ctrl"}+V
                </kbd>{" "}
                on this page
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5 text-left">
              <ClipboardPaste className="size-4 shrink-0 text-muted-foreground" />
              <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">
                Use the paste button in the banner
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5 text-left">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">
                Press{" "}
                <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground shadow-[0_1px_0_0] shadow-border">
                  {isMac ? "⌘" : "Ctrl"}+K
                </kbd>{" "}
                to search
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
