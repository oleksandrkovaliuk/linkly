import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { authorizeShareAccess } from "./lib/authorizeShareAccess";

function matchesQuery(
  query: string,
  link: {
    title: string;
    url: string;
    description?: string;
    category: string;
  }
) {
  const haystack = [link.title, link.url, link.description, link.category]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function normalizeUrl(input: string) {
  const raw = input.trim();
  if (!raw) {
    throw new ConvexError("[SHARED LINK]: url is required");
  }

  try {
    return new URL(raw).toString();
  } catch {
    throw new ConvexError("[SHARED LINK]: invalid url");
  }
}

async function logSharedLinkEvent(
  ctx: MutationCtx,
  input: {
    vaultId: Id<"vaults">;
    actorId: Id<"users">;
    shareId: Id<"shares">;
    eventType: "shared_link_added" | "shared_link_removed";
    summary: string;
    linkId?: Id<"links">;
  }
) {
  await ctx.db.insert("history_events", {
    vault_id: input.vaultId,
    actor_id: input.actorId,
    share_id: input.shareId,
    event_type: input.eventType,
    summary: input.summary,
    link_id: input.linkId,
    created_at: Date.now(),
  });
}

export const add = mutation({
  args: {
    shareId: v.id("shares"),
    url: v.string(),
  },
  handler: async (ctx, { shareId, url }) => {
    const share = await ctx.db.get(shareId);
    if (!share || share.revoked_at) {
      throw new ConvexError("[SHARED LINK ADD]: share not available");
    }
    const access = await authorizeShareAccess(ctx, share, { requiredRole: "editor" });
    const user = access.user;
    if (!user) {
      throw new ConvexError("[SHARED LINK ADD]: access denied");
    }

    const now = Date.now();
    const normalizedUrl = normalizeUrl(url);
    const linkId = await ctx.db.insert("links", {
      owner_id: user._id,
      url: normalizedUrl,
      title: normalizedUrl,
      category: "Other",
      enrichment_status: "pending",
      searchable_text: normalizedUrl.toLowerCase(),
      created_at: now,
      updated_at: now,
    });

    await ctx.db.insert("vault_links", {
      vault_id: share.vault_id,
      link_id: linkId,
      added_by: user._id,
      added_at: now,
    });
    await logSharedLinkEvent(ctx, {
      vaultId: share.vault_id,
      actorId: user._id,
      shareId,
      eventType: "shared_link_added",
      summary: `Added link ${normalizedUrl}`,
      linkId,
    });

    await ctx.scheduler.runAfter(0, internal.actions.linkEnrichment.enrichLink, {
      linkId,
    });
  },
});

export const remove = mutation({
  args: {
    shareId: v.id("shares"),
    linkId: v.id("links"),
  },
  handler: async (ctx, { shareId, linkId }) => {
    const share = await ctx.db.get(shareId);
    if (!share || share.revoked_at) {
      throw new ConvexError("[SHARED LINK REMOVE]: share not available");
    }
    const access = await authorizeShareAccess(ctx, share, { requiredRole: "editor" });
    const user = access.user;
    if (!user) {
      throw new ConvexError("[SHARED LINK REMOVE]: access denied");
    }

    const link = await ctx.db.get(linkId);
    if (!link) return;

    const vaultLink = await ctx.db
      .query("vault_links")
      .withIndex("by_link_id", (q) => q.eq("link_id", linkId))
      .first();

    if (vaultLink) {
      await ctx.db.delete(vaultLink._id);
    }

    const legacyRow = await ctx.db
      .query("shared_vault_links")
      .withIndex("by_link_id", (q) => q.eq("link_id", linkId))
      .first();
    if (legacyRow) {
      await ctx.db.delete(legacyRow._id);
    }

    await ctx.db.delete(linkId);
    await logSharedLinkEvent(ctx, {
      vaultId: share.vault_id,
      actorId: user._id,
      shareId: share._id,
      eventType: "shared_link_removed",
      summary: `Removed link ${link.title ?? link.url ?? "link"}`,
      linkId,
    });
  },
});

export const list = query({
  args: {
    token: v.string(),
    query: v.optional(v.string()),
  },
  handler: async (ctx, { token, query: textQuery }) => {
    const share = await ctx.db
      .query("shares")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!share) {
      throw new ConvexError("[SHARED LINKS LIST]: share not found");
    }

    await authorizeShareAccess(ctx, share);

    const vaultRows = await ctx.db
      .query("vault_links")
      .withIndex("by_vault_id", (q) => q.eq("vault_id", share.vault_id))
      .collect();
    const vaultLinkIds = new Set(vaultRows.map((r) => r.link_id as string));

    const legacyRows = await ctx.db
      .query("shared_vault_links")
      .withIndex("by_share_id", (q) => q.eq("share_id", share._id))
      .collect();
    const legacyOnlyRows = legacyRows.filter(
      (r) => !vaultLinkIds.has(r.link_id as string),
    );

    const userCache = new Map<string, { name: string | null; avatar: string | null }>();
    async function resolveUser(userId: string) {
      if (userCache.has(userId)) return userCache.get(userId)!;
      const u = await ctx.db.get(userId as Id<"users">);
      const info = {
        name: u?.name ?? u?.email ?? null,
        avatar: u?.image_url ?? null,
      };
      userCache.set(userId, info);
      return info;
    }

    const allLinks = await Promise.all([
      ...vaultRows.map(async (row) => {
        const link = await ctx.db.get(row.link_id);
        if (!link) return null;
        const addedByInfo = await resolveUser(row.added_by as string);
        return { ...link, addedByName: addedByInfo.name };
      }),
      ...legacyOnlyRows.map(async (row) => {
        const link = await ctx.db.get(row.link_id);
        if (!link) return null;
        const addedByInfo = await resolveUser(row.added_by as string);
        return { ...link, addedByName: addedByInfo.name };
      }),
    ]);

    const validLinks = allLinks.filter(
      (value): value is NonNullable<typeof value> => Boolean(value),
    );

    const normalized = textQuery?.trim();
    const filtered = normalized
      ? validLinks.filter((row) => matchesQuery(normalized, row))
      : validLinks;

    const sorted = filtered.sort((a, b) => b.updated_at - a.updated_at);

    return Promise.all(
      sorted.map(async (link) => {
        const views = await ctx.db
          .query("link_views")
          .withIndex("by_link_id", (q) => q.eq("link_id", link._id))
          .collect();
        const viewers = await Promise.all(
          views.map(async (view) => {
            const info = await resolveUser(view.user_id as string);
            return { userId: view.user_id, name: info.name, avatar: info.avatar };
          }),
        );
        return { ...link, viewers };
      }),
    );
  },
});
