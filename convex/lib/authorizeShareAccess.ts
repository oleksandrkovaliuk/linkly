import { ConvexError } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { authorizeVaultRole } from "./authorizeVaultAccess";

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

  const access = await authorizeVaultRole(ctx, share.vault_id, {
    requiredRole: requiredRole === "editor" ? "contributor" : "viewer",
  });
  if (access.role === "owner" || access.role === "contributor") {
    return { user: access.user, role: "editor" as const };
  }
  if (requiredRole === "viewer") {
    return { user: access.user, role: "viewer" as const };
  }
  throw new ConvexError("[SHARE ACCESS]: access denied");
}
