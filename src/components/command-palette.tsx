import { convexQuery } from "@convex-dev/react-query";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import { useAuth } from "~/hooks/use-auth";
import { smartSearch } from "~/lib/smart-search";
import {
  ChevronRight,
  ExternalLink,
  Globe,
  Loader2,
  Search,
  SearchX,
  X,
} from "lucide-react";
import * as React from "react";

import { Dialog, DialogContent } from "./ui/dialog";
import { Skeleton } from "./ui/skeleton";
import { VaultIdentity } from "./vault-identity";

type VaultResult = { _id: Id<"vaults">; name: string; emoji?: string };
type LinkResult = {
  _id: Id<"links">;
  title: string;
  url: string;
  favicon?: string;
  category?: string;
  description?: string;
  vaultId: Id<"vaults">;
  vaultName?: string;
};

type CommandPaletteProps = {
  defaultVaultId?: Id<"vaults"> | string;
  defaultVaultName?: string;
  /** When embedded in a controlled Dialog, pass open state so scope/search resets when the dialog closes */
  dialogOpen?: boolean;
};

function CommandPaletteContent({
  scopedVaultId: externalScopedId,
  scopedVaultName: externalScopedName,
  onClose,
  dialogOpen,
}: {
  scopedVaultId?: string;
  scopedVaultName?: string;
  onClose: () => void;
  /** When set (embedded dialog), reset when dialog closes */
  dialogOpen?: boolean;
}) {
  const [input, setInput] = React.useState("");
  const [debouncedInput, setDebouncedInput] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [scopedVaultId, setScopedVaultId] = React.useState<string | undefined>(
    externalScopedId
  );
  const [scopedVaultName, setScopedVaultName] = React.useState<
    string | undefined
  >(externalScopedName);
  const auth = useAuth();
  const navigate = useNavigate();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedInput(input), 300);
    return () => clearTimeout(id);
  }, [input]);

  const resetState = React.useCallback(() => {
    setInput("");
    setDebouncedInput("");
    setActiveIndex(0);
    setScopedVaultId(externalScopedId);
    setScopedVaultName(externalScopedName);
  }, [externalScopedId, externalScopedName]);

  React.useEffect(() => {
    resetState();
  }, [resetState]);

  React.useEffect(() => {
    if (dialogOpen === undefined) return;
    if (dialogOpen === false) {
      resetState();
    }
  }, [dialogOpen, resetState]);

  const isScoped = Boolean(scopedVaultId);
  const hasQuery = debouncedInput.length > 0;
  const isTyping = input !== debouncedInput;

  const { data: allVaults, isFetching: isFetchingVaults } = useQuery({
    enabled: auth.canQueryProtected,
    ...convexQuery(api.vaults.listMine, {}),
  });

  const typedVaults = ((allVaults ?? []) as VaultResult[]).slice(0);

  const parsedScope = React.useMemo(() => {
    if (isScoped || !hasQuery) return null;
    const match = debouncedInput.match(/^in:(\S+)\s*/);
    if (!match) return null;
    const vaultNameQuery = match[1]!.toLowerCase();
    const found = typedVaults.find(
      (v) => v.name.toLowerCase() === vaultNameQuery
    );
    if (!found) return null;
    return {
      vaultId: found._id,
      vaultName: found.name,
      remainingQuery: debouncedInput.slice(match[0].length),
    };
  }, [isScoped, hasQuery, debouncedInput, typedVaults]);

  const effectiveVaultId = scopedVaultId ?? parsedScope?.vaultId;
  const effectiveQuery = parsedScope
    ? parsedScope.remainingQuery
    : debouncedInput;

  const vaultsForLinks =
    isScoped || parsedScope
      ? typedVaults.filter((v) => v._id === effectiveVaultId)
      : typedVaults;

  const perVaultLinks = useQueries({
    queries: vaultsForLinks.map((vault) => ({
      enabled: auth.canQueryProtected,
      ...convexQuery(api.links.search, { vaultId: vault._id, query: "" }),
    })),
  });

  const allLinks = React.useMemo(() => {
    const out: LinkResult[] = [];
    for (let i = 0; i < vaultsForLinks.length; i += 1) {
      const vault = vaultsForLinks[i]!;
      const linksForVault = (perVaultLinks[i]?.data ?? []) as Array<{
        _id: Id<"links">;
        title: string;
        url: string;
        favicon?: string;
        category?: string;
        description?: string;
      }>;
      for (const link of linksForVault) {
        out.push({
          _id: link._id,
          title: link.title,
          url: link.url,
          favicon: link.favicon,
          category: link.category,
          description: link.description,
          vaultId: vault._id,
          vaultName: vault.name,
        });
      }
    }
    return out;
  }, [vaultsForLinks, perVaultLinks]);

  const isLoadingCandidates =
    isFetchingVaults || perVaultLinks.some((q) => q.isFetching);

  const showVaultsSection = !isScoped && !parsedScope;

  const vaults = React.useMemo(() => {
    if (!showVaultsSection) return [];
    const base = typedVaults;
    if (!hasQuery) return base;
    return smartSearch(
      base,
      effectiveQuery,
      (vault) => ({ title: vault.name }),
      { minScore: 1, limit: 5 }
    );
  }, [showVaultsSection, typedVaults, hasQuery, effectiveQuery]);

  const links = React.useMemo(() => {
    const q = effectiveQuery;
    if (!q && !isScoped && !parsedScope) return [] as LinkResult[];
    if (!q && (isScoped || parsedScope)) return allLinks.slice(0, 20);
    return smartSearch(
      allLinks,
      q,
      (link) => ({
        title: link.title,
        category: link.category ?? "",
        description: link.description ?? "",
        url: link.url,
        extra: [link.vaultName ?? ""],
      }),
      { minScore: 1, limit: 10 }
    );
  }, [allLinks, effectiveQuery, isScoped, parsedScope]);

  const items: Array<
    | { type: "vault"; vault: VaultResult }
    | { type: "link"; link: LinkResult }
  > = [
    ...vaults.map((v) => ({ type: "vault" as const, vault: v })),
    ...links.map((l) => ({ type: "link" as const, link: l })),
  ];

  const totalItems = items.length;
  const isLoading = isTyping || isLoadingCandidates;

  React.useEffect(() => {
    setActiveIndex(0);
  }, [debouncedInput]);

  function scopeToVault(vault: VaultResult) {
    setScopedVaultId(vault._id);
    setScopedVaultName(vault.name);
    setInput("");
    setDebouncedInput("");
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  function navigateToVault(vaultId: string) {
    onClose();
    void navigate({
      to: "/my-vaults/$vaultId",
      params: { vaultId },
    });
  }

  function activateItem(index: number) {
    const item = items[index];
    if (!item) return;
    if (item.type === "vault") {
      if (!hasQuery) {
        scopeToVault(item.vault);
      } else {
        navigateToVault(item.vault._id);
      }
    } else {
      navigateToVault(item.link.vaultId);
    }
  }

  function openLinkExternal(url: string, e: React.MouseEvent) {
    e.stopPropagation();
    window.open(url, "_blank", "noreferrer");
    onClose();
  }

  function clearScope() {
    setScopedVaultId(undefined);
    setScopedVaultName(undefined);
    setInput("");
    setDebouncedInput("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % Math.max(totalItems, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev <= 0 ? Math.max(totalItems - 1, 0) : prev - 1
      );
    } else if (e.key === "Enter" && totalItems > 0) {
      e.preventDefault();
      activateItem(activeIndex);
    } else if (e.key === "Backspace" && input === "" && isScoped) {
      clearScope();
    }
  }

  const showResults = !isLoading && totalItems > 0;
  const showEmpty =
    (hasQuery || isScoped || parsedScope) && !isLoading && totalItems === 0;
  const showDefault =
    !hasQuery && !isLoading && !isScoped && vaults.length > 0;

  return (
    <DialogContent
      showCloseButton={false}
      className="top-[40%] gap-0 p-0 sm:max-w-lg"
    >
      <div className="flex items-center gap-2 px-4 py-3">
        {isLoading ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Search className="size-4 shrink-0 text-muted-foreground" />
        )}

        {(isScoped || parsedScope) &&
        (scopedVaultName || parsedScope?.vaultName) ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            in:{scopedVaultName ?? parsedScope?.vaultName}
            <button
              type="button"
              onClick={clearScope}
              className="text-muted-foreground/60 transition-colors hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ) : null}

        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isScoped
              ? `Search in ${scopedVaultName}...`
              : "Search vaults and links..."
          }
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          autoFocus
        />
      </div>

      {isLoading ? (
        <div className="space-y-1 border-t border-border/50 px-4 py-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 py-1.5">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 flex-1 rounded" />
            </div>
          ))}
        </div>
      ) : null}

      {showResults || showDefault ? (
        <div className="max-h-72 overflow-y-auto border-t border-border/50">
          {vaults.length > 0 ? (
            <div className="px-2 pb-1 pt-2">
              <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Vaults
              </p>
              {vaults.map((vault, i) => {
                const globalIdx = i;
                return (
                  <button
                    key={vault._id}
                    type="button"
                    onClick={() => activateItem(globalIdx)}
                    onMouseEnter={() => setActiveIndex(globalIdx)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                      activeIndex === globalIdx
                        ? "bg-accent text-accent-foreground"
                        : ""
                    }`}
                  >
                    <VaultIdentity emoji={vault.emoji} />
                    <span className="min-w-0 flex-1 truncate">
                      {vault.name}
                    </span>
                    {!hasQuery ? (
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/40" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {links.length > 0 ? (
            <div className="px-2 pb-2 pt-2">
              <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Links
              </p>
              {links.map((link, i) => {
                const globalIdx = vaults.length + i;
                return (
                  <button
                    key={link._id}
                    type="button"
                    onClick={() => activateItem(globalIdx)}
                    onMouseEnter={() => setActiveIndex(globalIdx)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                      activeIndex === globalIdx
                        ? "bg-accent text-accent-foreground"
                        : ""
                    }`}
                  >
                    {link.favicon ? (
                      <img
                        src={link.favicon}
                        alt=""
                        aria-hidden
                        className="size-4 shrink-0 rounded-sm"
                      />
                    ) : (
                      <Globe className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{link.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {link.vaultName
                          ? `${link.vaultName} · ${link.url}`
                          : link.url}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => openLinkExternal(link.url, e)}
                      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Open link"
                    >
                      <ExternalLink className="size-3.5" />
                    </button>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {showEmpty ? (
        <div className="border-t border-border/50 px-4 py-6 text-center">
          <SearchX className="mx-auto mb-2 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No matching vaults or links
          </p>
        </div>
      ) : null}

      {/* Scope hint */}
      {!isScoped && !hasQuery && !isLoading ? (
        <div className="border-t border-border/50 px-4 py-2">
          <p className="text-[11px] text-muted-foreground/50">
            Select a vault to scope search, or type{" "}
            <kbd className="rounded bg-muted px-1 font-mono text-[10px]">
              in:vault-name
            </kbd>{" "}
            to filter
          </p>
        </div>
      ) : null}
    </DialogContent>
  );
}

export function CommandPalette({
  defaultVaultId,
  defaultVaultName,
  dialogOpen,
}: CommandPaletteProps = {}) {
  const isStandalone = !defaultVaultId;
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isStandalone) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isStandalone]);

  if (isStandalone) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <CommandPaletteContent
          onClose={() => setOpen(false)}
          dialogOpen={open}
        />
      </Dialog>
    );
  }

  return (
    <CommandPaletteContent
      scopedVaultId={defaultVaultId as string}
      scopedVaultName={defaultVaultName}
      onClose={() => {}}
      dialogOpen={dialogOpen}
    />
  );
}
