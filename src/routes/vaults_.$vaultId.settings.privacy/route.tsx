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
import { Badge } from "~/components/ui/badge";
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

export const Route = createFileRoute("/vaults_/$vaultId/settings/privacy")({
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
    role: "viewer" | "editor" | "contributor";
    status: "pending" | "active" | "accepted" | "declined";
  }>;
};

type InviteWithAvatar = {
  _id: Id<"share_invites">;
  email: string;
  role: "viewer" | "editor" | "contributor";
  status: "pending" | "active" | "accepted" | "declined";
  token?: string;
  avatar?: string | null;
};

type MemberRow = {
  membership: {
    user_id: Id<"users">;
    role: "viewer" | "contributor";
  };
  user?: {
    email?: string | null;
    name?: string | null;
    image_url?: string | null;
  } | null;
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
  const { data: membersData, isLoading: isMembersLoading } = useQuery({
    enabled: auth.canQueryProtected,
    ...convexQuery(api.shares.listMembers, { vaultId: typedVaultId }),
  });

  const typedShareData = shareData as ShareState | null | undefined;
  const isPublic = typedShareData?.share?.is_public ?? false;
  const publicToken = typedShareData?.share?.token;
  const invites = (invitesData ?? []) as InviteWithAvatar[];
  const members = (membersData ?? []) as MemberRow[];

  const { mutate: setAccess, isPending: isSettingAccess } = useMutation({
    mutationFn: useConvexMutation(api.shares.setAccess),
  });
  const { mutate: upsertInvite, isPending: isInviting } = useMutation({
    mutationFn: useConvexMutation(api.shares.upsertInvite),
  });
  const { mutate: removeInvite } = useMutation({
    mutationFn: useConvexMutation(api.shares.removeInvite),
  });
  const { mutate: removeMember } = useMutation({
    mutationFn: useConvexMutation(api.shares.removeMember),
  });
  const { mutate: removeVault, isPending: isRemovingVault } = useMutation({
    mutationFn: useConvexMutation(api.vaults.remove),
  });

  function invalidateShareQueries() {
    void queryClient.invalidateQueries(
      convexQuery(api.shares.listInvites, { vaultId: typedVaultId })
    );
    void queryClient.invalidateQueries(
      convexQuery(api.shares.listMembers, { vaultId: typedVaultId })
    );
    void queryClient.invalidateQueries(
      convexQuery(api.shares.getMineForVault, { vaultId: typedVaultId })
    );
    void queryClient.invalidateQueries(convexQuery(api.vaults.listMine, {}));
  }

  function handleSetVisibility(pub: boolean) {
    setAccess(
      { vaultId: typedVaultId, isPublic: pub },
      {
        onSuccess: () => {
          invalidateShareQueries();
          toast.success(
            pub
              ? "Vault is public. A fresh view-only link was created."
              : "Vault is private. The public link was invalidated."
          );
        },
        onError: (error) => toast.error(error.message),
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
      { vaultId: typedVaultId, email: trimmed, role: "contributor" },
      {
        onSuccess: () => {
          invalidateShareQueries();
          setInviteEmail("");
          toast.success(`Invitation sent to ${trimmed}`);
        },
        onError: (error) => setInviteError(error.message),
      }
    );
  }

  function handleRemoveInvite(inviteId: Id<"share_invites">) {
    removeInvite(
      { inviteId },
      {
        onSuccess: invalidateShareQueries,
        onError: (error) => toast.error(error.message),
      }
    );
  }

  function handleRemoveMember(userId: Id<"users">) {
    removeMember(
      { vaultId: typedVaultId, userId },
      {
        onSuccess: invalidateShareQueries,
        onError: (error) => toast.error(error.message),
      }
    );
  }

  function handleDeleteVault() {
    removeVault(
      { vaultId: typedVaultId },
      {
        onSuccess: () => {
          toast.success("Vault deleted");
          void navigate({ to: "/vaults" });
        },
        onError: (error) => toast.error(error.message),
      }
    );
  }

  const isLoading = isShareLoading || isInvitesLoading || isMembersLoading;

  if (isLoading) {
    return <SettingsLoadingState />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Privacy</h2>
        <p className="text-sm text-muted-foreground">
          Control public visibility, temporary invites, and accepted members.
        </p>
      </div>

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
              Only owner and accepted members can open it
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
              Anyone with the public link can view only
            </span>
          </button>
        </div>
        {isPublic && publicToken ? (
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Public route: <span className="font-mono">/public/{publicToken}</span>
          </div>
        ) : null}
      </div>

      <Separator />

      <div className="space-y-3">
        <label className="text-sm font-medium">Invite inbox</label>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Invites are pending until the recipient accepts. The invite token is
          consumed after accept or decline.
        </p>

        <div className="flex items-start gap-2">
          <Input
            value={inviteEmail}
            onChange={(event) => {
              setInviteEmail(event.target.value);
              setInviteError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
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
                <span className="size-1.5 shrink-0 rounded-full bg-amber-400" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {invite.email}
                </span>
                <Badge variant="secondary">{invite.status}</Badge>
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
            No pending invites
          </p>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <label className="text-sm font-medium">Members</label>
        {members.length ? (
          <div className="space-y-1">
            {members.map((member) => (
              <div
                key={member.membership.user_id}
                className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {member.user?.email ?? member.user?.name ?? "Member"}
                </span>
                <Badge variant="outline">{member.membership.role}</Badge>
                <button
                  type="button"
                  onClick={() => handleRemoveMember(member.membership.user_id)}
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  aria-label="Remove member"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-2 text-center text-xs text-muted-foreground">
            No accepted members yet
          </p>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <label className="text-sm font-medium text-destructive">
          Danger zone
        </label>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Permanently delete this vault and revoke all access. This cannot be
          undone.
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
                access. This cannot be undone.
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
