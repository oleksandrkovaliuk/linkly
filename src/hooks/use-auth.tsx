import { useSession, useUser } from "@clerk/clerk-react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "~/convex/_generated/api";
import { useConvexAuth } from "convex/react";
import * as React from "react";

export function useAuth() {
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();

  const { user: _clerkUser } = useUser();

  const { session } = useSession();

  const authResolved = !isConvexAuthLoading;
  const { data: user, status } = useQuery({
    enabled: authResolved && isAuthenticated,
    ...convexQuery(api.users.getUser),
  });

  const { mutate: syncUserProfile } = useMutation({
    mutationFn: useConvexMutation(api.users.syncUserProfile),
  });

  const isLoading = isConvexAuthLoading;
  const syncedForUserRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!authResolved || !isAuthenticated || status !== "success") return;
    const clerkUserId = _clerkUser?.id ?? null;
    if (!clerkUserId) return;
    if (syncedForUserRef.current === clerkUserId) return;

    syncUserProfile({});
    syncedForUserRef.current = clerkUserId;
  }, [authResolved, isAuthenticated, status, syncUserProfile, _clerkUser?.id]);

  const canQueryProtected = authResolved && Boolean(user?._id);

  return {
    user,
    session,
    isLoading,
    authResolved,
    canQueryProtected,
    _clerkUser,
    authenticated: authResolved && isAuthenticated,
  };
}

export type AuthContext = ReturnType<typeof useAuth>;
