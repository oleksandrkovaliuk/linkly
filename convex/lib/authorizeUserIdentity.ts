import { ConvexError } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

export const authorizeUserIdentity = async (
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<Doc<"users">> => {
  const identity = await ctx.auth.getUserIdentity();
  const clerkId = identity?.subject;
  if (!clerkId || !("db" in ctx)) {
    throw new ConvexError(
      `[AUTHORIZE USER IDENTITY]: access denied no user found.`
    );
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerk_id", clerkId))
    .first();

  if (!user) {
    throw new ConvexError(
      `[AUTHORIZE USER IDENTITY]: access denied no user found.`
    );
  }

  return user;
};
