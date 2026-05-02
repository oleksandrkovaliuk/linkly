import { ConvexError } from "convex/values";

import { authorizeUserIdentity } from "./authorizeUserIdentity";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function authorizeVaultAccess(
  ctx: QueryCtx | MutationCtx,
  vaultId: Id<"vaults">
) {
  const user = await authorizeUserIdentity(ctx);
  const vault = await ctx.db.get(vaultId);

  if (!vault) {
    throw new ConvexError("[VAULT ACCESS]: vault not found");
  }

  if (vault.owner_id !== user._id) {
    throw new ConvexError("[VAULT ACCESS]: access denied");
  }

  return { user, vault };
}
