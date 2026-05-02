import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { SettingsLoadingState } from "~/components/page-skeletons";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import { useAuth } from "~/hooks/use-auth";
import { Globe, Lock, Plus, Trash2, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/my-vaults_/$vaultId/settings/privacy"
)({
  component: PrivacySettings,
});

type ShareState = {
  share: {
    _id: Id<"shares">;
    token: string;
    is_public: boolean;
  };
  invites: Array<{
    _id: Id<"share_invites">;
    email: string;
    role: "viewer" | "editor";
    status: "pending" | "active";
  }>;
};

type InviteWithAvatar = {
  _id: Id<"share_invites">;
  email: string;
  role: "viewer" | "editor";
  status: "pending" | "active";
  avatar?: string | null;
};

function PrivacySettings() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { vaultId } = Route.useParams();
  const typedVaultId = vaultId as Id<"vaults">;
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);

  const { data: shareData, isLoading: isShareLoading } = useQuery({
    enabled: auth.canQueryProtected,
    ...convexQuery(api.shares.getMineForVault, { vaultId: typedVaultId }),
  });

  const { data: invitesData, isLoading: isInvitesLoading } = useQuery({
    enabled: auth.canQueryProtected,
    ...convexQuery(api.shares.listInvites, { vaultId: typedVaultId }),
  });

  const typedShareData = shareData as ShareState | null | undefined;
  const isPublic = typedShareData?.share?.is_public ?? false;
  const invites = (invitesData ?? []) as InviteWithAvatar[];

  const { mutate: setAccess, isPending: isSettingAccess } = useMutation({
    mutationFn: useConvexMutation(api.shares.setAccess),
  });
  const { mutate: upsertInvite, isPending: isInviting } = useMutation({
    mutationFn: useConvexMutation(api.shares.upsertInvite),
  });
  const { mutate: removeInvite } = useMutation({
    mutationFn: useConvexMutation(api.shares.removeInvite),
  });
  const { mutate: removeVault, isPending: isRemovingVault } = useMutation({
    mutationFn: useConvexMutation(api.vaults.remove),
  });

  function invalidateShareQueries() {
    void queryClient.invalidateQueries(
      convexQuery(api.shares.listInvites, { vaultId: typedVaultId })
    );
    void queryClient.invalidateQueries(
      convexQuery(api.shares.getMineForVault, { vaultId: typedVaultId })
    );
    void queryClient.invalidateQueries(convexQuery(api.shares.listReceived, {}));
  }

  function handleSetVisibility(pub: boolean) {
    setAccess(
      { vaultId: typedVaultId, isPublic: pub },
      {
        onSuccess: () => {
          invalidateShareQueries();
          toast.success(pub ? "Vault is now public" : "Vault is now private");
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  function handleAddInvite() {
    const trimmed = inviteEmail.trim().toLowerCase();
    if (!trimmed) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setInviteError("Enter a valid email address");
      return;
    }
    setInviteError(null);
    upsertInvite(
      { vaultId: typedVaultId, email: trimmed, role: "editor" },
      {
        onSuccess: () => {
          invalidateShareQueries();
          setInviteEmail("");
          toast.success(`Invited ${trimmed}`);
        },
        onError: (err) => setInviteError(err.message),
      }
    );
  }

  function handleRemoveInvite(inviteId: Id<"share_invites">) {
    removeInvite(
      { inviteId },
      {
        onSuccess: () => {
          invalidateShareQueries();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  function handleDeleteVault() {
    removeVault(
      { vaultId: typedVaultId },
      {
        onSuccess: () => {
          toast.success("Vault deleted");
          void navigate({ to: "/my-vaults" });
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  const isLoading = isShareLoading || isInvitesLoading;

  if (isLoading) {
    return <SettingsLoadingState />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Privacy</h2>
        <p className="text-sm text-muted-foreground">
          Control who can access this vault.
        </p>
      </div>

      {/* Visibility */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Visibility</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isSettingAccess}
            onClick={() => handleSetVisibility(false)}
            className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm transition-colors ${
              !isPublic
                ? "border-foreground/20 bg-accent"
                : "border-border hover:border-border/80 hover:bg-accent/50"
            }`}
          >
            <Lock className="size-4 text-muted-foreground" />
            <span className="font-medium">Private</span>
            <span className="text-[11px] leading-tight text-muted-foreground">
              Only you and invited contributors can see this vault
            </span>
          </button>
          <button
            type="button"
            disabled={isSettingAccess}
            onClick={() => handleSetVisibility(true)}
            className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm transition-colors ${
              isPublic
                ? "border-foreground/20 bg-accent"
                : "border-border hover:border-border/80 hover:bg-accent/50"
            }`}
          >
            <Globe className="size-4 text-muted-foreground" />
            <span className="font-medium">Public</span>
            <span className="text-[11px] leading-tight text-muted-foreground">
              Anyone with a link can view this vault
            </span>
          </button>
        </div>
      </div>

      <Separator />

      {/* Contributors */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Contributors</label>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Contributors can add, edit, and remove links in this vault.
        </p>

        <div className="flex items-start gap-2">
          <Input
            value={inviteEmail}
            onChange={(e) => {
              setInviteEmail(e.target.value);
              setInviteError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddInvite();
              }
            }}
            type="email"
            placeholder="email@example.com"
            className="h-8 flex-1 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            loading={isInviting}
            onClick={handleAddInvite}
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
        {inviteError ? (
          <p className="text-xs text-destructive">{inviteError}</p>
        ) : null}

        {invites.length > 0 ? (
          <div className="space-y-1 pt-1">
            {invites.map((invite) => (
              <div
                key={invite._id}
                className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
              >
                <span
                  className={`size-1.5 shrink-0 rounded-full ${
                    invite.status === "active"
                      ? "bg-emerald-500"
                      : "bg-amber-400"
                  }`}
                  title={
                    invite.status === "active" ? "Active" : "Pending"
                  }
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {invite.email}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {invite.status === "pending" ? "Pending" : "Active"}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveInvite(invite._id)}
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  aria-label={`Remove ${invite.email}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-2 text-center text-xs text-muted-foreground">
            No contributors yet
          </p>
        )}
      </div>

      <Separator />

      {/* Danger zone */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-destructive">
          Danger zone
        </label>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Permanently delete this vault and revoke all active shares. This
          cannot be undone.
        </p>
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogTrigger
            render={
              <Button variant="destructive" size="sm" type="button">
                <Trash2 className="size-3.5" />
                Delete vault
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10">
                <Trash2 className="size-5 text-destructive" />
              </AlertDialogMedia>
              <AlertDialogTitle>Delete vault</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the vault and revoke all active
                shares. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                loading={isRemovingVault}
                onClick={handleDeleteVault}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
