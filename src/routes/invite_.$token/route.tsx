import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { AppShellSkeleton } from "~/components/app-shell-skeleton";
import { SignInToContinue } from "~/components/sign-in-to-continue";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import { useAuth } from "~/hooks/use-auth";
import { Check, Lock, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/invite_/$token")({
  beforeLoad: ({ context }) => {
    if (context.auth?.authResolved && !context.auth.authenticated) {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: InviteDecisionRoute,
});

type InviteData = {
  invite: {
    role: "viewer" | "editor" | "contributor";
    email: string;
  };
  vault: {
    _id: Id<"vaults">;
    name?: string;
    color?: string | null;
    emoji?: string;
  } | null;
  inviter: {
    email?: string | null;
    name?: string | null;
  } | null;
  signedInEmail?: string | null;
  canAccept: boolean;
};

function InviteDecisionRoute() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { token } = Route.useParams();

  const { data, isLoading, isError } = useQuery({
    retry: 1,
    ...convexQuery(api.shares.getInviteByToken, { token }),
  });

  const { mutate: acceptInvite, isPending: isAccepting } = useMutation({
    mutationFn: useConvexMutation(api.shares.acceptInvite),
  });
  const { mutate: declineInvite, isPending: isDeclining } = useMutation({
    mutationFn: useConvexMutation(api.shares.declineInvite),
  });

  if (!auth.authenticated && auth.authResolved) {
    return (
      <SignInToContinue
        title="Sign in to review this invite"
        description="Private vault invites require the invited email address."
      />
    );
  }

  if (!auth.canQueryProtected || isLoading) {
    return <AppShellSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <Lock className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Invite unavailable</p>
        <p className="text-sm text-muted-foreground">
          This invite was already used, declined, revoked, or does not exist.
        </p>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link to="/vaults">Go to vaults</Link>}
        />
      </div>
    );
  }

  const inviteData = data as InviteData;

  function handleAccept() {
    acceptInvite(
      { token },
      {
        onSuccess: (result: { vaultId: Id<"vaults"> }) => {
          toast.success("Vault added");
          void navigate({
            to: "/vaults/$vaultId",
            params: { vaultId: result.vaultId },
          });
        },
        onError: (error) => toast.error(error.message),
      }
    );
  }

  function handleDecline() {
    declineInvite(
      { token },
      {
        onSuccess: () => {
          toast.success("Invite declined");
          void navigate({ to: "/vaults" });
        },
        onError: (error) => toast.error(error.message),
      }
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center p-6">
      <Card className="relative overflow-hidden p-0">
        <div
          className="h-28"
          style={{
            background: `linear-gradient(135deg, ${
              inviteData.vault?.color ?? "#6b7280"
            }44, transparent)`,
          }}
        />
        <div className="space-y-5 px-5 pb-5">
          <div className="-mt-8 flex items-end gap-3">
            <span
              className="flex size-16 items-center justify-center rounded-2xl border-2 border-background bg-background/80 text-3xl shadow-sm backdrop-blur-sm"
              style={{
                backgroundColor: `${inviteData.vault?.color ?? "#6b7280"}20`,
              }}
            >
              {inviteData.vault?.emoji ?? "📁"}
            </span>
            <Badge variant="secondary">Invitation</Badge>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold">
              Join {inviteData.vault?.name ?? "this vault"}?
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {inviteData.inviter?.email ??
                inviteData.inviter?.name ??
                "Someone"}{" "}
              invited {inviteData.invite.email} as{" "}
              {inviteData.invite.role === "viewer" ? "viewer" : "contributor"}.
              Accepting adds this vault to your Vaults hub.
            </p>
          </div>

          {!inviteData.canAccept ? (
            <div className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
              Sign in as {inviteData.invite.email} to accept this invite. You
              are currently signed in as {inviteData.signedInEmail ?? "another user"}.
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button
              className="flex-1"
              loading={isAccepting}
              disabled={!inviteData.canAccept}
              onClick={handleAccept}
            >
              <Check className="size-4" />
              Accept
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              loading={isDeclining}
              disabled={!inviteData.canAccept}
              onClick={handleDecline}
            >
              <X className="size-4" />
              Decline
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
