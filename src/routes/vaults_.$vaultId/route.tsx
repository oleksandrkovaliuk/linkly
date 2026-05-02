import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useMatches,
} from "@tanstack/react-router";
import { AppShellSkeleton } from "~/components/app-shell-skeleton";
import { CommandPalette } from "~/components/command-palette";
import { SignInToContinue } from "~/components/sign-in-to-continue";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogTrigger } from "~/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { VaultIdentity } from "~/components/vault-identity";
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

export const Route = createFileRoute("/vaults_/$vaultId")({
  beforeLoad: ({ context }) => {
    if (context.auth?.authResolved && !context.auth.authenticated) {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: VaultRoute,
});

type VaultDetail = {
  _id: Id<"vaults">;
  name: string;
  emoji?: string;
  color?: string;
  accessRole?: "owner" | "contributor" | "viewer" | "public_viewer";
  canEdit?: boolean;
  canManageAccess?: boolean;
};

function VaultRoute() {
  const auth = useAuth();
  const { vaultId } = Route.useParams();
  const typedVaultId = vaultId as Id<"vaults">;
  const matches = useMatches();
  const isOnSettings = matches.some((match) => match.id.includes("settings"));
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

  const { mutate: addToVault, isPending: isAddingLink } = useMutation({
    mutationFn: useConvexMutation(api.links.create),
  });
  const { mutate: recordOpen } = useMutation({
    mutationFn: useConvexMutation(api.vaults.recordOpen),
  });

  React.useEffect(() => {
    if (!auth.canQueryProtected) return;
    recordOpen({ vaultId: typedVaultId });
  }, [auth.canQueryProtected, recordOpen, typedVaultId]);

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
            onSuccess: () => toast.success("Link added"),
            onError: (error) => toast.error(error.message),
          }
        );
      })
      .catch(() => toast.error("Unable to read clipboard"));
  }

  useVaultFavicon(vault?.emoji ?? undefined);

  if (!auth.authenticated && auth.authResolved) {
    return (
      <SignInToContinue
        title="Sign in to open this vault"
        description="Private vaults require invited access."
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
          You do not have permission to view this vault.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          nativeButton={false}
          render={<Link to="/vaults">Back to vaults</Link>}
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
          render={<Link to="/vaults">Back to vaults</Link>}
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
  const canEdit = Boolean(vault.canEdit);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
      <div className="relative h-20 w-full shrink-0 rounded-b-xl">
        <div
          className="absolute inset-0 rounded-b-xl"
          style={{
            background: `linear-gradient(135deg, ${vaultColor}33, ${vaultColor}08)`,
          }}
        />

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
                      to="/vaults/$vaultId/history"
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
                      to="/vaults/$vaultId/settings"
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

          {canEdit ? (
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
          ) : null}
        </div>

        <div className="absolute bottom-0 left-6 translate-y-1/2">
          <div className="flex size-12 items-center justify-center rounded-xl border-2 border-background bg-background/60 text-xl shadow-sm backdrop-blur-sm">
            <VaultIdentity emoji={vault.emoji} size="md" />
          </div>
        </div>
      </div>

      <div className="px-6 pb-4 pt-8">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">{vault.name}</h1>
          <Badge variant={vault.accessRole === "owner" ? "outline" : "secondary"}>
            {vault.accessRole === "owner"
              ? "Owner"
              : vault.accessRole === "contributor"
                ? "Contributor"
                : "Viewer"}
          </Badge>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6">
        <Outlet />
      </div>
    </div>
  );
}
