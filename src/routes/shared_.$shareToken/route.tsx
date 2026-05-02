import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { VaultIdentity } from "~/components/vault-identity";
import { api } from "~/convex/_generated/api";
import { useAuth } from "~/hooks/use-auth";
import { ClipboardPaste, History, Lock } from "lucide-react";
import { AppShellSkeleton } from "~/components/app-shell-skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/shared_/$shareToken")({
  component: RouteComponent,
  errorComponent: ProtectedShareError,
});

function RouteComponent() {
  const auth = useAuth();
  const { shareToken } = Route.useParams();

  const {
    data: shareData,
    isLoading: isShareLoading,
    isError: isShareError,
  } = useQuery({
    retry: 1,
    ...convexQuery(api.shares.getByToken, { token: shareToken }),
  });

  const { mutate: addToShare, isPending: isAddingLink } = useMutation({
    mutationFn: useConvexMutation(api.sharedVaultLinks.add),
  });

  const canEdit =
    auth.canQueryProtected && shareData?.share && shareData?.canEdit;

  function handlePasteLink() {
    if (!shareData?.share) return;
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
        addToShare(
          { shareId: shareData.share._id, url: trimmed },
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

  if (isShareLoading) {
    return <AppShellSkeleton />;
  }

  if (isShareError || !shareData?.vault) {
    return <ProtectedShareError />;
  }

  const vault = shareData.vault;
  const sharer = shareData.sharer;
  const isReadOnly = !shareData.canEdit;
  const vaultColor = (vault as { color?: string }).color ?? "#6b7280";
  const sharerEmail =
    (sharer as { email?: string })?.email ??
    (sharer as { name?: string })?.name;

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

        {/* Action buttons — top-right */}
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-background/60 p-0.5 backdrop-blur-sm">
          {auth.canQueryProtected ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    render={
                      <Link
                        to="/shared/$shareToken/history"
                        params={{ shareToken }}
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
          ) : null}
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

        {/* Shared by badge — bottom-right */}
        {sharerEmail ? (
          <div className="absolute bottom-3 right-3 rounded-md bg-background/60 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur-sm">
            by {sharerEmail}
          </div>
        ) : null}

        {/* Emoji avatar */}
        <div className="absolute bottom-0 left-6 translate-y-1/2">
          <div className="flex size-12 items-center justify-center rounded-xl border-2 border-background bg-background/60 text-xl shadow-sm backdrop-blur-sm">
            <VaultIdentity emoji={(vault as { emoji?: string }).emoji} size="md" />
          </div>
        </div>
      </div>

      {/* Vault info */}
      <div className="px-6 pt-8 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">
            {(vault as { name?: string }).name ?? "Shared Vault"}
          </h1>
          {isReadOnly ? (
            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              View only
            </span>
          ) : null}
        </div>
        {isReadOnly ? (
          <p className="mt-1 text-xs text-muted-foreground">
            You can open links; adding links requires edit access.
          </p>
        ) : null}
      </div>

      <div className="flex-1 px-6 pb-6">
        <Outlet />
      </div>
    </div>
  );
}

function ProtectedShareError() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <Lock className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">Protected vault</p>
      <p className="text-sm text-muted-foreground">
        This shared vault is no longer available, or you need to sign in with
        the invited email to access it.
      </p>
    </div>
  );
}
