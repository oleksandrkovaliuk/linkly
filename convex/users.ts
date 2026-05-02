import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const getUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("[INTERNAL]: getUser: no user identity found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerk_id", identity.subject))
      .first();

    if (!user) {
      return undefined;
    }

    return user;
  },
});

export const syncUserProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    const clerkId = identity?.subject;

    if (!clerkId) {
      throw new Error("[INTERNAL]: syncUserProfile: no clerk id found");
    }

    console.log("[INTERNAL]: syncUserProfile running for clerk id", clerkId);

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerk_id", clerkId))
      .first();

    console.log("identity", identity);
    const data = {
      clerk_id: clerkId,
      name: identity.name ?? null,
      email: identity.email?.toLowerCase() ?? null,
      last_name: identity.familyName ?? null,
      first_name: identity.givenName ?? null,
      image_url: identity.pictureUrl ?? null,
    };

    let userId: Id<"users">;
    if (existingUser) {
      await ctx.db.patch(existingUser._id, data);
      userId = existingUser._id;
    } else {
      userId = await ctx.db.insert("users", data);

      const now = Date.now();
      const vaultId = await ctx.db.insert("vaults", {
        owner_id: userId,
        name: "My Vault",
        color: "#6b7280",
        emoji: "📁",
        created_at: now,
        updated_at: now,
      });
      await ctx.db.insert("history_events", {
        vault_id: vaultId,
        actor_id: userId,
        event_type: "vault_created",
        summary: "Created default vault",
        created_at: now,
      });
    }

    return clerkId;
  },
});
