import { ConvexError } from "convex/values";

import { api } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

export const authorizeUserIdentity = async (
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<Doc<"users">> => {
  const user = await ctx.runQuery(api.users.getUser);

  if (!user) {
    throw new ConvexError(
      `[AUTHORIZE USER IDENTITY]: access denied no user found.`
    );
  }

  return user;
};
