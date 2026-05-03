import { v } from "convex/values";

import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { authorizeUserIdentity } from "./lib/authorizeUserIdentity";
import { authorizeVaultRole } from "./lib/authorizeVaultAccess";

const VISIBLE_EVENT_TYPES = new Set([
  "link_added",
  "link_removed",
  "link_viewed",
  "member_added",
  "member_removed",
]);

const EVENT_TYPE_LABELS: Record<string, string> = {
  link_added: "Link added",
  link_removed: "Link removed",
  link_viewed: "Link viewed",
  member_added: "Member added",
  member_removed: "Member removed",
  link_deleted: "Link removed",
  shared_link_added: "Link saved",
  shared_link_removed: "Link removed",
};

function humanizeEventType(raw: string) {
  return EVENT_TYPE_LABELS[raw] ?? raw.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function humanizeEventSummary(input: {
  type: string;
  actorName: string;
  linkTitle?: string | null;
  targetName?: string | null;
  fallback: string;
}) {
  const linkTitle = input.linkTitle ?? "a link";
  const targetName = input.targetName ?? "a member";

  switch (input.type) {
    case "link_added":
    case "shared_link_added":
      return `${input.actorName} added ${linkTitle}`;
    case "link_removed":
    case "link_deleted":
    case "shared_link_removed":
      return `${input.actorName} removed ${linkTitle}`;
    case "link_viewed":
      return `${input.actorName} viewed ${linkTitle}`;
    case "member_added":
      return `${targetName} joined the vault`;
    case "member_removed":
      return `${targetName} left the vault`;
    default:
      return input.fallback;
  }
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

  const flatRows = rows
    .flat()
    .filter((row) => VISIBLE_EVENT_TYPES.has(row.event_type));
  const users = await Promise.all(flatRows.map((row) => ctx.db.get(row.actor_id)));
  const links = await Promise.all(
    flatRows.map((row) => (row.link_id ? ctx.db.get(row.link_id) : null))
  );
  const targetUsers = await Promise.all(
    flatRows.map((row) =>
      row.target_user_id ? ctx.db.get(row.target_user_id) : null
    )
  );

  return flatRows
    .map((row, index) => {
      const vault = vaultMap.get(row.vault_id as string);
      const actorName = users[index]?.email ?? users[index]?.name ?? "Unknown";
      const targetName =
        targetUsers[index]?.email ?? targetUsers[index]?.name ?? null;
      return {
        id: row._id as string,
        type: row.event_type,
        humanType: humanizeEventType(row.event_type),
        at: row.created_at,
        by: actorName,
        byUserId: row.actor_id as string,
        byAvatar: users[index]?.image_url ?? null,
        summary: humanizeEventSummary({
          type: row.event_type,
          actorName,
          linkTitle: row.target_title ?? links[index]?.title,
          targetName,
          fallback: row.summary,
        }),
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
  const memberships = await ctx.db
    .query("vault_memberships")
    .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
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
  for (const membership of memberships) {
    if (!membership.revoked_at) vaultIdSet.add(membership.vault_id as string);
  }
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
    await authorizeVaultRole(ctx, vaultId, { requiredRole: "viewer" });
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
    return allRows
      .filter((row) => row.byUserId !== (user._id as string))
      .sort((a, b) => b.at - a.at);
  },
});
