import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { authorizeUserIdentity } from "./lib/authorizeUserIdentity";
import { authorizeVaultRole } from "./lib/authorizeVaultAccess";

function buildSearchableText(input: {
  url: string;
  title: string;
  description?: string;
  category: string;
}) {
  return [input.url, input.title, input.description, input.category]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function normalizeUrl(input: string) {
  const raw = input.trim();
  if (!raw) {
    throw new ConvexError("[LINK]: url is required");
  }

  try {
    return new URL(raw).toString();
  } catch {
    throw new ConvexError("[LINK]: invalid url");
  }
}

async function logHistoryEvent(
  ctx: MutationCtx,
  input: {
    vaultId: Id<"vaults">;
    actorId: Id<"users">;
    eventType:
      | "link_added"
      | "link_updated"
      | "link_deleted"
      | "link_removed"
      | "link_viewed";
    summary: string;
    linkId?: Id<"links">;
  }
) {
  await ctx.db.insert("history_events", {
    vault_id: input.vaultId,
    actor_id: input.actorId,
    event_type: input.eventType,
    summary: input.summary,
    link_id: input.linkId,
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

export const create = mutation({
  args: {
    vaultId: v.id("vaults"),
    url: v.string(),
  },
  handler: async (ctx, { vaultId, url }) => {
    const { user } = await authorizeVaultRole(ctx, vaultId, {
      requiredRole: "contributor",
    });
    if (!user) {
      throw new ConvexError("[LINK CREATE]: access denied");
    }
    const normalizedUrl = normalizeUrl(url);

    const now = Date.now();
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
      vault_id: vaultId,
      link_id: linkId,
      added_by: user._id,
      added_at: now,
    });
    await logHistoryEvent(ctx, {
      vaultId,
      actorId: user._id,
      eventType: "link_added",
      summary: `Added link ${normalizedUrl}`,
      linkId,
    });
    await touchVaultRecent(ctx, {
      userId: user._id,
      vaultId,
      action: "link_added",
    });

    await ctx.scheduler.runAfter(
      0,
      internal.actions.linkEnrichment.enrichLink,
      {
        linkId,
      }
    );

    return linkId;
  },
});

export const update = mutation({
  args: {
    linkId: v.id("links"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { linkId, ...patch }) => {
    const link = await ctx.db.get(linkId);
    if (!link) {
      throw new ConvexError("[LINK UPDATE]: access denied");
    }

    const title = patch.title ?? link.title;
    const description = patch.description ?? link.description;
    const category = patch.category ?? link.category;

    const vaultLinks = await ctx.db
      .query("vault_links")
      .withIndex("by_link_id", (q) => q.eq("link_id", linkId))
      .collect();
    const vaultLink = vaultLinks[0];
    if (!vaultLink) {
      throw new ConvexError("[LINK UPDATE]: vault link not found");
    }
    const { user } = await authorizeVaultRole(ctx, vaultLink.vault_id, {
      requiredRole: "contributor",
    });
    if (!user) {
      throw new ConvexError("[LINK UPDATE]: access denied");
    }

    await ctx.db.patch(linkId, {
      ...patch,
      searchable_text: buildSearchableText({
        url: link.url,
        title,
        description,
        category,
      }),
      updated_at: Date.now(),
    });
    await Promise.all(
      vaultLinks.map((row) =>
        logHistoryEvent(ctx, {
          vaultId: row.vault_id,
          actorId: user._id,
          eventType: "link_updated",
          summary: `Updated link ${title}`,
          linkId,
        })
      )
    );
  },
});

export const remove = mutation({
  args: { linkId: v.id("links") },
  handler: async (ctx, { linkId }) => {
    const link = await ctx.db.get(linkId);

    if (!link) {
      throw new ConvexError("[LINK REMOVE]: access denied");
    }

    const vaultLinks = await ctx.db
      .query("vault_links")
      .withIndex("by_link_id", (q) => q.eq("link_id", linkId))
      .collect();
    const vaultLink = vaultLinks[0];
    if (!vaultLink) {
      throw new ConvexError("[LINK REMOVE]: vault link not found");
    }
    const { user } = await authorizeVaultRole(ctx, vaultLink.vault_id, {
      requiredRole: "contributor",
    });
    if (!user) {
      throw new ConvexError("[LINK REMOVE]: access denied");
    }
    const sharedLinks = await ctx.db
      .query("shared_vault_links")
      .withIndex("by_link_id", (q) => q.eq("link_id", linkId))
      .collect();

    await Promise.all(vaultLinks.map((row) => ctx.db.delete(row._id)));
    await Promise.all(sharedLinks.map((row) => ctx.db.delete(row._id)));
    await Promise.all(
      vaultLinks.map((row) =>
        logHistoryEvent(ctx, {
          vaultId: row.vault_id,
          actorId: user._id,
          eventType: "link_removed",
          summary: `Deleted link ${link.title}`,
          linkId,
        })
      )
    );
    await touchVaultRecent(ctx, {
      userId: user._id,
      vaultId: vaultLink.vault_id,
      action: "link_removed",
    });
    await ctx.db.delete(linkId);
  },
});

export const setPinned = mutation({
  args: {
    vaultId: v.id("vaults"),
    linkId: v.id("links"),
    pinned: v.boolean(),
  },
  handler: async (ctx, { vaultId, linkId, pinned }) => {
    const { user } = await authorizeVaultRole(ctx, vaultId, {
      requiredRole: "contributor",
    });
    if (!user) {
      throw new ConvexError("[LINK PIN]: access denied");
    }

    const vaultLink = await ctx.db
      .query("vault_links")
      .withIndex("by_link_id", (q) => q.eq("link_id", linkId))
      .first();
    if (!vaultLink || vaultLink.vault_id !== vaultId) {
      throw new ConvexError("[LINK PIN]: link not found in vault");
    }

    await ctx.db.patch(vaultLink._id, {
      pinned_at: pinned ? Date.now() : undefined,
      pinned_by: pinned ? user._id : undefined,
    });
    await touchVaultRecent(ctx, {
      userId: user._id,
      vaultId,
      action: pinned ? "link_pinned" : "link_unpinned",
    });
  },
});

export const listByVault = query({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, { vaultId }) => {
    await authorizeVaultRole(ctx, vaultId, { requiredRole: "viewer" });
    const vaultLinks = await ctx.db
      .query("vault_links")
      .withIndex("by_vault_id", (q) => q.eq("vault_id", vaultId))
      .collect();
    const rows = await Promise.all(
      vaultLinks.map(async (row) => {
        const link = await ctx.db.get(row.link_id);
        return link ? { ...link, pinned_at: row.pinned_at } : null;
      })
    );

    return rows
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .sort((a, b) => {
        const pinnedA = a.pinned_at ?? 0;
        const pinnedB = b.pinned_at ?? 0;
        if (pinnedA !== pinnedB) return pinnedB - pinnedA;
        return b.updated_at - a.updated_at;
      });
  },
});

export const search = query({
  args: {
    vaultId: v.id("vaults"),
    query: v.string(),
  },
  handler: async (ctx, { vaultId, query: searchQuery }) => {
    await authorizeVaultRole(ctx, vaultId, { requiredRole: "viewer" });
    const normalized = searchQuery.trim();

    const allVaultLinks = await ctx.db
      .query("vault_links")
      .withIndex("by_vault_id", (q) => q.eq("vault_id", vaultId))
      .collect();

    const vaultLinkByLinkId = new Map(
      allVaultLinks.map((row) => [row.link_id as string, row]),
    );

    let rawLinks;
    if (!normalized) {
      const allLinks = await Promise.all(
        allVaultLinks
          .map((row) => ctx.db.get(row.link_id))
          .filter((value) => Boolean(value)),
      );
      if (!allLinks?.length) return [];
      rawLinks = allLinks
        .filter(Boolean)
        .sort((a, b) => b!.updated_at - a!.updated_at);
    } else {
      const matches = await ctx.db
        .query("links")
        .withSearchIndex("search_links", (q) =>
          q.search("searchable_text", normalized),
        )
        .take(200);
      rawLinks = matches.filter((row) => vaultLinkByLinkId.has(row._id as string));
    }

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

    return Promise.all(
      rawLinks.map(async (link) => {
        const vl = vaultLinkByLinkId.get(link!._id as string);
        const addedByInfo = vl ? await resolveUser(vl.added_by as string) : null;

        const views = await ctx.db
          .query("link_views")
          .withIndex("by_link_id", (q) => q.eq("link_id", link!._id))
          .collect();
        const viewers = await Promise.all(
          views.map(async (view) => {
            const info = await resolveUser(view.user_id as string);
            return { userId: view.user_id, name: info.name, avatar: info.avatar };
          }),
        );

        return {
          ...link,
          addedByName: addedByInfo?.name ?? null,
          addedByAvatar: addedByInfo?.avatar ?? null,
          pinnedAt: vl?.pinned_at ?? null,
          viewers,
        };
      }),
    );
  },
});

export const patchMetadata = internalMutation({
  args: {
    linkId: v.id("links"),
    title: v.string(),
    description: v.optional(v.string()),
    favicon: v.optional(v.string()),
    image: v.optional(v.string()),
    category: v.string(),
  },
  handler: async (ctx, { linkId, ...patch }) => {
    const link = await ctx.db.get(linkId);
    if (!link) return;

    await ctx.db.patch(linkId, {
      ...patch,
      enrichment_status: "ready",
      searchable_text: buildSearchableText({
        url: link.url,
        title: patch.title,
        description: patch.description,
        category: patch.category,
      }),
      updated_at: Date.now(),
    });
  },
});

export const markEnrichmentError = internalMutation({
  args: {
    linkId: v.id("links"),
  },
  handler: async (ctx, { linkId }) => {
    const link = await ctx.db.get(linkId);
    if (!link) return;

    await ctx.db.patch(linkId, {
      enrichment_status: "error",
      updated_at: Date.now(),
    });
  },
});

export const getLinkById = internalQuery({
  args: { linkId: v.id("links") },
  handler: async (ctx, { linkId }) => {
    return await ctx.db.get(linkId);
  },
});

export const recordView = mutation({
  args: { linkId: v.id("links") },
  handler: async (ctx, { linkId }) => {
    const user = await authorizeUserIdentity(ctx);
    const vaultLink = await ctx.db
      .query("vault_links")
      .withIndex("by_link_id", (q) => q.eq("link_id", linkId))
      .first();
    if (!vaultLink) {
      throw new ConvexError("[LINK VIEW]: vault link not found");
    }
    await authorizeVaultRole(ctx, vaultLink.vault_id, { requiredRole: "viewer" });

    const existing = await ctx.db
      .query("link_views")
      .withIndex("by_link_id_user_id", (q) =>
        q.eq("link_id", linkId).eq("user_id", user._id),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { viewed_at: Date.now() });
    } else {
      await ctx.db.insert("link_views", {
        link_id: linkId,
        user_id: user._id,
        viewed_at: Date.now(),
      });
    }
    await logHistoryEvent(ctx, {
      vaultId: vaultLink.vault_id,
      actorId: user._id,
      eventType: "link_viewed",
      summary: "Viewed a link",
      linkId,
    });
    await touchVaultRecent(ctx, {
      userId: user._id,
      vaultId: vaultLink.vault_id,
      action: "link_viewed",
    });
  },
});

export const searchGlobal = query({
  args: { query: v.string() },
  handler: async (ctx, { query: searchQuery }) => {
    const user = await authorizeUserIdentity(ctx);
    const normalized = searchQuery.trim();
    if (!normalized) return { vaults: [], links: [] };

    const allVaults = await ctx.db
      .query("vaults")
      .withIndex("by_owner_id", (q) => q.eq("owner_id", user._id))
      .collect();
    const matchingVaults = allVaults.filter((v) =>
      v.name.toLowerCase().includes(normalized.toLowerCase()),
    );

    const linkMatches = await ctx.db
      .query("links")
      .withSearchIndex("search_links", (q) =>
        q.search("searchable_text", normalized).eq("owner_id", user._id),
      )
      .take(10);

    const vaultLinks = await Promise.all(
      linkMatches.map((link) =>
        ctx.db
          .query("vault_links")
          .withIndex("by_link_id", (q) => q.eq("link_id", link._id))
          .first(),
      ),
    );
    const vaultMap = new Map<string, { name: string; emoji?: string }>();
    for (const vl of vaultLinks) {
      if (vl && !vaultMap.has(vl.vault_id)) {
        const vault = await ctx.db.get(vl.vault_id);
        if (vault) {
          vaultMap.set(vl.vault_id, { name: vault.name, emoji: vault.emoji });
        }
      }
    }

    return {
      vaults: matchingVaults
        .slice(0, 5)
        .map((v) => ({ _id: v._id, name: v.name, emoji: v.emoji })),
      links: linkMatches.map((link, i) => ({
        _id: link._id,
        title: link.title,
        url: link.url,
        favicon: link.favicon,
        vaultId: vaultLinks[i]?.vault_id,
        vaultName: vaultMap.get(vaultLinks[i]?.vault_id ?? "")?.name,
      })),
    };
  },
});

export const searchGlobalCandidates = query({
  args: {},
  handler: async (ctx) => {
    const user = await authorizeUserIdentity(ctx);

    const vaults = await ctx.db
      .query("vaults")
      .withIndex("by_owner_id", (q) => q.eq("owner_id", user._id))
      .collect();

    const links = await ctx.db
      .query("links")
      .withIndex("by_owner_id", (q) => q.eq("owner_id", user._id))
      .collect();

    const vaultById = new Map(
      vaults.map((v) => [
        v._id as string,
        { name: v.name, emoji: v.emoji, color: v.color },
      ]),
    );

    const vaultLinks = await Promise.all(
      vaults.map((vault) =>
        ctx.db
          .query("vault_links")
          .withIndex("by_vault_id", (q) => q.eq("vault_id", vault._id))
          .collect(),
      ),
    );

    const vaultLinkByLinkId = new Map<string, string>();
    for (const row of vaultLinks.flat()) {
      const v = vaultById.get(row.vault_id as string);
      if (!v) continue;
      vaultLinkByLinkId.set(row.link_id as string, row.vault_id as string);
    }

    return {
      vaults: vaults.map((v) => ({
        _id: v._id,
        name: v.name,
        emoji: v.emoji,
      })),
      links: links
        .map((link) => {
          const vaultId = vaultLinkByLinkId.get(link._id as string);
          if (!vaultId) return null;
          const v = vaultById.get(vaultId);
          return {
            _id: link._id,
            title: link.title,
            url: link.url,
            favicon: link.favicon,
            category: link.category,
            description: link.description,
            vaultId: vaultId as Id<"vaults">,
            vaultName: v?.name ?? null,
            vaultEmoji: v?.emoji ?? null,
          };
        })
        .filter(
          (value): value is NonNullable<typeof value> => Boolean(value),
        ),
    };
  },
});
