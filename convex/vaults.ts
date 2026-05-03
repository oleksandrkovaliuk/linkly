import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { authorizeUserIdentity } from "./lib/authorizeUserIdentity";
import {
  authorizeVaultAccess,
  authorizeVaultRole,
} from "./lib/authorizeVaultAccess";

const DEFAULT_VAULT_COLOR = "#6b7280";
const DEFAULT_VAULT_EMOJI = "📁";

async function logHistoryEvent(
  ctx: MutationCtx,
  input: {
    vaultId: Id<"vaults">;
    actorId: Id<"users">;
    eventType:
      | "vault_created"
      | "vault_updated"
      | "vault_deleted"
      | "share_created"
      | "share_revoked"
      | "link_added"
      | "link_updated"
      | "link_deleted"
      | "shared_link_added"
      | "shared_link_removed";
    summary: string;
  }
) {
  await ctx.db.insert("history_events", {
    vault_id: input.vaultId,
    actor_id: input.actorId,
    event_type: input.eventType,
    summary: input.summary,
    created_at: Date.now(),
  });
}

async function touchVaultRecent(
  ctx: MutationCtx,
  input: {
    userId: Id<"users">;
    vaultId: Id<"vaults">;
    action:
      | "vault_opened"
      | "link_viewed"
      | "link_added"
      | "link_removed"
      | "link_pinned"
      | "link_unpinned"
      | "invite_accepted";
  }
) {
  const existing = await ctx.db
    .query("vault_recents")
    .withIndex("by_user_id_vault_id", (q) =>
      q.eq("user_id", input.userId).eq("vault_id", input.vaultId)
    )
    .first();
  const now = Date.now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      last_active_at: now,
      last_action: input.action,
    });
    return;
  }

  await ctx.db.insert("vault_recents", {
    user_id: input.userId,
    vault_id: input.vaultId,
    last_active_at: now,
    last_action: input.action,
  });
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await authorizeUserIdentity(ctx);

    const ownedVaults = await ctx.db
      .query("vaults")
      .withIndex("by_owner_id", (q) => q.eq("owner_id", user._id))
      .collect();
    const memberships = await ctx.db
      .query("vault_memberships")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();
    const memberVaults = await Promise.all(
      memberships
        .filter((membership) => !membership.revoked_at)
        .map(async (membership) => {
          const vault = await ctx.db.get(membership.vault_id);
          return vault ? { vault, membership } : null;
        })
    );

    return Promise.all(
      [
        ...ownedVaults.map((vault) => ({
          vault,
          accessRole: "owner" as const,
          vaultType: "owned" as const,
        })),
        ...memberVaults
          .filter((row): row is NonNullable<typeof row> => Boolean(row))
          .map(({ vault, membership }) => ({
            vault,
            accessRole: membership.role,
            vaultType: "shared" as const,
          })),
      ].map(async ({ vault, accessRole, vaultType }) => {
        const vaultLinks = await ctx.db
          .query("vault_links")
          .withIndex("by_vault_id", (q) => q.eq("vault_id", vault._id))
          .collect();
        const links = await Promise.all(
          vaultLinks.slice(0, 20).map((row) => ctx.db.get(row.link_id)),
        );
        const counts = new Map<string, number>();
        for (const link of links) {
          if (!link) continue;
          counts.set(link.category, (counts.get(link.category) ?? 0) + 1);
        }
        const topCategories = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([cat]) => cat);

        return {
          ...vault,
          accessRole,
          vaultType,
          linkCount: vaultLinks.length,
          topCategories,
        };
      }),
    );
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
    emoji: v.optional(v.string()),
  },
  handler: async (ctx, { name, color, emoji }) => {
    const user = await authorizeUserIdentity(ctx);
    const now = Date.now();

    const vaultId = await ctx.db.insert("vaults", {
      owner_id: user._id,
      name: name.trim() || "Untitled Vault",
      color: color?.trim() || DEFAULT_VAULT_COLOR,
      emoji: emoji?.trim() || DEFAULT_VAULT_EMOJI,
      created_at: now,
      updated_at: now,
    });
    await logHistoryEvent(ctx, {
      vaultId,
      actorId: user._id,
      eventType: "vault_created",
      summary: `Created vault ${name.trim() || "Untitled Vault"}`,
    });
    return vaultId;
  },
});

export const createDefaultIfMissing = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authorizeUserIdentity(ctx);
    const existing = await ctx.db
      .query("vaults")
      .withIndex("by_owner_id", (q) => q.eq("owner_id", user._id))
      .first();

    if (existing) return existing._id;

    const now = Date.now();
    const vaultId = await ctx.db.insert("vaults", {
      owner_id: user._id,
      name: "My Vault",
      color: DEFAULT_VAULT_COLOR,
      emoji: DEFAULT_VAULT_EMOJI,
      created_at: now,
      updated_at: now,
    });
    return vaultId;
  },
});

export const recordOpen = mutation({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, { vaultId }) => {
    const access = await authorizeVaultRole(ctx, vaultId, {
      requiredRole: "viewer",
    });
    if (!access.user) {
      return;
    }
    await touchVaultRecent(ctx, {
      userId: access.user._id,
      vaultId,
      action: "vault_opened",
    });
  },
});

export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    const user = await authorizeUserIdentity(ctx);
    const rows = await ctx.db
      .query("vault_recents")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();

    const sorted = rows
      .sort((a, b) => b.last_active_at - a.last_active_at)
      .slice(0, 6);

    const vaults = await Promise.all(
      sorted.map(async (row) => {
        const vault = await ctx.db.get(row.vault_id);
        if (!vault) return null;
        if (vault.owner_id === user._id) {
          return { ...vault, recent: row, accessRole: "owner" as const };
        }
        const membership = await ctx.db
          .query("vault_memberships")
          .withIndex("by_vault_id_user_id", (q) =>
            q.eq("vault_id", row.vault_id).eq("user_id", user._id)
          )
          .first();
        if (!membership || membership.revoked_at) return null;
        return { ...vault, recent: row, accessRole: membership.role };
      })
    );

    return vaults.filter(
      (vault): vault is NonNullable<typeof vault> => Boolean(vault)
    );
  },
});

export const get = query({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, { vaultId }) => {
    const access = await authorizeVaultRole(ctx, vaultId, {
      requiredRole: "viewer",
    });
    return {
      ...access.vault,
      accessRole: access.role,
      canEdit:
        access.role === "owner" || access.role === "contributor",
      canManageAccess: access.role === "owner",
      canDelete: access.role === "owner",
    };
  },
});

export const update = mutation({
  args: {
    vaultId: v.id("vaults"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    emoji: v.optional(v.string()),
  },
  handler: async (ctx, { vaultId, name, color, emoji }) => {
    const { user, vault } = await authorizeVaultRole(ctx, vaultId, {
      requiredRole: "contributor",
    });
    if (!user) {
      throw new ConvexError("[VAULT UPDATE]: access denied");
    }
    await ctx.db.patch(vaultId, {
      ...(name ? { name: name.trim() } : {}),
      ...(color ? { color: color.trim() } : {}),
      ...(emoji ? { emoji: emoji.trim() } : {}),
      updated_at: Date.now(),
    });
    await logHistoryEvent(ctx, {
      vaultId,
      actorId: user._id,
      eventType: "vault_updated",
      summary: `Updated vault ${name?.trim() || vault.name}`,
    });
  },
});

export const remove = mutation({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, { vaultId }) => {
    const { user, vault } = await authorizeVaultAccess(ctx, vaultId);

    const shares = await ctx.db
      .query("shares")
      .withIndex("by_vault_id", (q) => q.eq("vault_id", vaultId))
      .collect();

    await Promise.all(
      shares.map((share) => ctx.db.patch(share._id, { revoked_at: Date.now() }))
    );

    const vaultLinks = await ctx.db
      .query("vault_links")
      .withIndex("by_vault_id", (q) => q.eq("vault_id", vaultId))
      .collect();
    await Promise.all(
      vaultLinks.map(async (row) => {
        await ctx.db.delete(row._id);
        await ctx.db.delete(row.link_id);
      })
    );

    const sharedLinks = await Promise.all(
      shares.map((share) =>
        ctx.db
          .query("shared_vault_links")
          .withIndex("by_share_id", (q) => q.eq("share_id", share._id))
          .collect()
      )
    );
    await Promise.all(
      sharedLinks.flat().map(async (row) => {
        await ctx.db.delete(row._id);
        await ctx.db.delete(row.link_id);
      })
    );

    await logHistoryEvent(ctx, {
      vaultId,
      actorId: user._id,
      eventType: "vault_deleted",
      summary: `Deleted vault ${vault.name}`,
    });

    await ctx.db.delete(vaultId);
  },
});
