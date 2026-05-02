import { v } from "convex/values";

import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { authorizeUserIdentity } from "./lib/authorizeUserIdentity";
import { authorizeVaultAccess } from "./lib/authorizeVaultAccess";

const VISIBLE_EVENT_TYPES = new Set([
  "link_added",
  "link_updated",
  "link_deleted",
  "vault_updated",
  "vault_deleted",
  "share_made_public",
  "invite_sent",
  "shared_link_added",
  "shared_link_removed",
]);

const EVENT_TYPE_LABELS: Record<string, string> = {
  link_added: "Link saved",
  link_updated: "Link edited",
  link_deleted: "Link removed",
  vault_updated: "Vault edited",
  vault_deleted: "Vault deleted",
  share_made_public: "Shared publicly",
  invite_sent: "Contributor invited",
  shared_link_added: "Link saved",
  shared_link_removed: "Link removed",
};

function humanizeEventType(raw: string) {
  return EVENT_TYPE_LABELS[raw] ?? raw.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

type HistoryEventDTO = {
  id: string;
  type: string;
  humanType: string;
  at: number;
  by: string;
  byUserId: string;
  byAvatar: string | null;
  summary: string;
  vaultId: string;
  vaultName: string;
  vaultColor: string | null;
  vaultEmoji: string | null;
};

async function toHistoryRows(
  ctx: QueryCtx,
  vaultIds: Array<Id<"vaults">>
): Promise<HistoryEventDTO[]> {
  const vaultDocs = await Promise.all(vaultIds.map((id) => ctx.db.get(id)));
  const vaultMap = new Map(
    vaultDocs
      .filter((v): v is NonNullable<typeof v> => Boolean(v))
      .map((v) => [v._id as string, v])
  );

  const rows = await Promise.all(
    vaultIds.map((vaultId) =>
      ctx.db
        .query("history_events")
        .withIndex("by_vault_id", (q) => q.eq("vault_id", vaultId))
        .collect()
    )
  );

  const flatRows = rows.flat().filter((row) => VISIBLE_EVENT_TYPES.has(row.event_type));
  const users = await Promise.all(flatRows.map((row) => ctx.db.get(row.actor_id)));

  return flatRows
    .map((row, index) => {
      const vault = vaultMap.get(row.vault_id as string);
      return {
        id: row._id as string,
        type: row.event_type,
        humanType: humanizeEventType(row.event_type),
        at: row.created_at,
        by: users[index]?.email ?? users[index]?.name ?? "Unknown",
        byUserId: row.actor_id as string,
        byAvatar: users[index]?.image_url ?? null,
        summary: row.summary,
        vaultId: row.vault_id as string,
        vaultName: vault?.name ?? "Deleted vault",
        vaultColor: vault?.color ?? null,
        vaultEmoji: vault?.emoji ?? null,
      };
    })
    .sort((a, b) => b.at - a.at);
}

async function collectUserVaultIds(
  ctx: QueryCtx,
  user: { _id: Id<"users">; email?: string | null },
) {
  const ownedVaults = await ctx.db
    .query("vaults")
    .withIndex("by_owner_id", (q) => q.eq("owner_id", user._id))
    .collect();

  const legacyShares = await ctx.db
    .query("shares")
    .withIndex("by_shared_with", (q) => q.eq("shared_with", user._id))
    .collect();

  const normalizedEmail = user.email?.trim().toLowerCase();
  const invites = normalizedEmail
    ? await ctx.db
        .query("share_invites")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .collect()
    : [];
  const activeInvites = invites.filter((i) => !i.revoked_at);
  const invitedShares = await Promise.all(
    activeInvites.map((i) => ctx.db.get(i.share_id)),
  );

  const vaultIdSet = new Set<string>();
  for (const v of ownedVaults) vaultIdSet.add(v._id as string);
  for (const s of legacyShares) {
    if (!s.revoked_at) vaultIdSet.add(s.vault_id as string);
  }
  for (const s of invitedShares) {
    if (s && !s.revoked_at) vaultIdSet.add(s.vault_id as string);
  }

  return Array.from(vaultIdSet) as Array<Id<"vaults">>;
}

export const listForVault = query({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, { vaultId }) => {
    await authorizeVaultAccess(ctx, vaultId);
    return await toHistoryRows(ctx, [vaultId]);
  },
});

export const listGlobal = query({
  args: {},
  handler: async (ctx) => {
    const user = await authorizeUserIdentity(ctx);
    const vaultIds = await collectUserVaultIds(ctx, user);
    if (vaultIds.length === 0) return [];
    return await toHistoryRows(ctx, vaultIds);
  },
});

export const listInbox = query({
  args: {},
  handler: async (ctx) => {
    const user = await authorizeUserIdentity(ctx);
    const vaultIds = await collectUserVaultIds(ctx, user);
    if (vaultIds.length === 0) return [];

    const allRows = await toHistoryRows(ctx, vaultIds);
    const filtered = allRows.filter((row) => row.byUserId !== (user._id as string));

    const viewRows = await Promise.all(
      vaultIds.map(async (vaultId) => {
        const vaultLinks = await ctx.db
          .query("vault_links")
          .withIndex("by_vault_id", (q) => q.eq("vault_id", vaultId))
          .collect();
        const views = await Promise.all(
          vaultLinks.map(async (vl) => {
            const linkViews = await ctx.db
              .query("link_views")
              .withIndex("by_link_id", (q) => q.eq("link_id", vl.link_id))
              .collect();
            return linkViews.filter((lv) => lv.user_id !== user._id);
          }),
        );
        return { vaultId, views: views.flat() };
      }),
    );

    const vaultDocs = await Promise.all(vaultIds.map((id) => ctx.db.get(id)));
    const vaultMap = new Map(
      vaultDocs
        .filter((v): v is NonNullable<typeof v> => Boolean(v))
        .map((v) => [v._id as string, v]),
    );

    const viewDTOs: HistoryEventDTO[] = [];
    for (const { vaultId, views } of viewRows) {
      for (const view of views) {
        const link = await ctx.db.get(view.link_id);
        const viewer = await ctx.db.get(view.user_id);
        const vault = vaultMap.get(vaultId as string);
        viewDTOs.push({
          id: view._id as string,
          type: "link_viewed",
          humanType: "Link viewed",
          at: view.viewed_at,
          by: viewer?.email ?? viewer?.name ?? "Unknown",
          byUserId: view.user_id as string,
          byAvatar: viewer?.image_url ?? null,
          summary: `Viewed ${link?.title ?? "a link"}`,
          vaultId: vaultId as string,
          vaultName: vault?.name ?? "Deleted vault",
          vaultColor: vault?.color ?? null,
          vaultEmoji: vault?.emoji ?? null,
        });
      }
    }

    return [...filtered, ...viewDTOs].sort((a, b) => b.at - a.at);
  },
});
