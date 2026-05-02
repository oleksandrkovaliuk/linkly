import { ConvexError } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { authorizeUserIdentity } from "./authorizeUserIdentity";

type RequiredRole = "viewer" | "editor";

export async function authorizeShareAccess(
  ctx: QueryCtx | MutationCtx,
  share: Doc<"shares">,
  options?: {
    requiredRole?: RequiredRole;
  }
) {
  const requiredRole = options?.requiredRole ?? "viewer";

  if (share.revoked_at) {
    throw new ConvexError("[SHARE ACCESS]: access denied");
  }

  if (share.is_public && requiredRole === "viewer") {
    return { user: undefined, role: "viewer" as const };
  }

  const user = await authorizeUserIdentity(ctx);
  const normalizedEmail = user.email?.trim().toLowerCase() ?? null;

  if (share.shared_by === user._id) {
    return { user, role: "editor" as const };
  }

  if (share.shared_with === user._id) {
    return { user, role: "editor" as const };
  }

  const invites = await ctx.db
    .query("share_invites")
    .withIndex("by_share_id", (q) => q.eq("share_id", share._id))
    .collect();
  const invite = invites.find((value) => {
    if (value.revoked_at) return false;
    if (value.user_id === user._id) return true;
    if (!normalizedEmail) return false;
    return value.email === normalizedEmail;
  });

  if (!invite) {
    throw new ConvexError("[SHARE ACCESS]: access denied");
  }

  if (
    normalizedEmail &&
    invite.status === "pending" &&
    invite.email === normalizedEmail &&
    (!invite.user_id || invite.user_id !== user._id) &&
    "patch" in ctx.db
  ) {
    await ctx.db.patch(invite._id, {
      status: "active",
      user_id: user._id,
      updated_at: Date.now(),
    });
  }

  const resolvedRole = invite.role;
  if (requiredRole === "editor" && resolvedRole !== "editor") {
    throw new ConvexError("[SHARE ACCESS]: access denied");
  }

  return { user, role: resolvedRole };
}
