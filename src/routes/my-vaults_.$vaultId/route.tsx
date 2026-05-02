import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  Outlet,
  useMatches,
} from "@tanstack/react-router";
import { AppShellSkeleton } from "~/components/app-shell-skeleton";
import { SignInToContinue } from "~/components/sign-in-to-continue";
import { Button } from "~/components/ui/button";
import { VaultIdentity } from "~/components/vault-identity";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import { useAuth } from "~/hooks/use-auth";
import { useVaultFavicon } from "~/hooks/use-vault-favicon";
import {
  AlertTriangle,
  ClipboardPaste,
  History,
  Lock,
  Search,
  Settings,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { CommandPalette } from "~/components/command-palette";
import { Dialog, DialogTrigger } from "~/components/ui/dialog";

export const Route = createFileRoute("/my-vaults_/$vaultId")({
  component: RouteComponent,
});

type VaultDetail = {
  _id: Id<"vaults">;
  name: string;
  emoji?: string;
  color?: string;
};

function RouteComponent() {
  const auth = useAuth();
  const { vaultId } = Route.useParams();
  const typedVaultId = vaultId as Id<"vaults">;
  const matches = useMatches();
  const isOnSettings = matches.some((m) => m.id.includes("settings"));
  const [vaultSearchOpen, setVaultSearchOpen] = React.useState(false);

  const {
    data: vaultData,
    isPending: isVaultPending,
    error: vaultError,
    isError: isVaultError,
  } = useQuery({
    enabled: auth.canQueryProtected,
    retry: 1,
    ...convexQuery(api.vaults.get, { vaultId: typedVaultId }),
  });

  const vault = vaultData as VaultDetail | undefined;

  const { data: invitesData } = useQuery({
    enabled: auth.canQueryProtected && !!vault,
    ...convexQuery(api.shares.listInvites, { vaultId: typedVaultId }),
  });
  const invites = (invitesData ?? []) as Array<{
    _id: string;
    email: string;
    avatar?: string | null;
    status: "pending" | "active";
  }>;

  const { mutate: addToVault, isPending: isAddingLink } = useMutation({
    mutationFn: useConvexMutation(api.links.create),
  });

  function handlePasteLink() {
    navigator.clipboard
      .readText()
      .then((text) => {
        const trimmed = text.trim();
        if (!trimmed) {
          toast.error("Clipboard is empty");
          return;
        }
        try {
          new URL(trimmed);
        } catch {
          toast.error("Clipboard doesn't contain a valid URL");
          return;
        }
        addToVault(
          { vaultId: typedVaultId, url: trimmed },
          {
            onSuccess: () => {
              toast.success("Link added");
            },
            onError: (err) => {
              toast.error(err.message);
            },
          }
        );
      })
      .catch(() => {
        toast.error("Unable to read clipboard");
      });
  }

  useVaultFavicon(vault?.emoji ?? undefined);

  if (!auth.authenticated && auth.authResolved) {
    return (
      <SignInToContinue
        title="Sign in to open this vault"
        description="Your vaults are available after you sign in."
      />
    );
  }

  if (!auth.canQueryProtected) {
    return null;
  }

  if (isVaultError || vaultError) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <Lock className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Access denied</p>
        <p className="text-sm text-muted-foreground">
          You don't have permission to view this vault.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          nativeButton={false}
          render={<Link to="/my-vaults">Back to my vaults</Link>}
        />
      </div>
    );
  }

  if (isVaultPending) {
    return <AppShellSkeleton />;
  }

  if (!vault) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          This vault could not be found.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          nativeButton={false}
          render={<Link to="/my-vaults">Back to my vaults</Link>}
        />
      </div>
    );
  }

  if (isOnSettings) {
    return (
      <div className="flex w-full flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    );
  }

  const vaultColor = vault.color ?? "#6b7280";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
      {/* Banner */}
      <div className="relative h-20 w-full shrink-0 rounded-b-xl">
        <div
          className="absolute inset-0 rounded-b-xl"
          style={{
            background: `linear-gradient(135deg, ${vaultColor}33, ${vaultColor}08)`,
          }}
        />

        {/* Action buttons overlapping top-right */}
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-background/60 p-0.5 backdrop-blur-sm">
          <Dialog open={vaultSearchOpen} onOpenChange={setVaultSearchOpen}>
            <DialogTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Search in vault">
                  <Search className="size-4" />
                </Button>
              }
            />
            <CommandPalette
              defaultVaultId={typedVaultId}
              defaultVaultName={vault.name}
              dialogOpen={vaultSearchOpen}
            />
          </Dialog>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  nativeButton={false}
                  render={
                    <Link
                      to="/my-vaults/$vaultId/history"
                      params={{ vaultId }}
                      preload="intent"
                    />
                  }
                  aria-label="History"
                >
                  <History className="size-4" />
                </Button>
              }
            />
            <TooltipContent>History</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  nativeButton={false}
                  render={
                    <Link
                      to="/my-vaults/$vaultId/settings"
                      params={{ vaultId }}
                      preload="intent"
                    />
                  }
                  aria-label="Settings"
                >
                  <Settings className="size-4" />
                </Button>
              }
            />
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  loading={isAddingLink}
                  onClick={handlePasteLink}
                  aria-label="Paste link"
                >
                  <ClipboardPaste className="size-4" />
                </Button>
              }
            />
            <TooltipContent>Paste link from clipboard</TooltipContent>
          </Tooltip>
        </div>

        {/* Emoji avatar overlapping bottom edge */}
        <div className="absolute bottom-0 left-6 translate-y-1/2">
          <div className="flex size-12 items-center justify-center rounded-xl border-2 border-background bg-background/60 text-xl shadow-sm backdrop-blur-sm">
            <VaultIdentity emoji={vault.emoji} size="md" />
          </div>
        </div>
      </div>

      {/* Vault info */}
      <div className="px-6 pt-8 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{vault.name}</h1>
          {invites.length > 0 ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {invites.length} contributor{invites.length !== 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex-1 px-6 pb-6">
        <Outlet />
      </div>
    </div>
  );
}
