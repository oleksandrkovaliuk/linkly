import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { authorizeShareAccess } from "./lib/authorizeShareAccess";
import { authorizeUserIdentity } from "./lib/authorizeUserIdentity";
import {
  authorizeVaultAccess,
  authorizeVaultRole,
  getAuthenticatedUser,
} from "./lib/authorizeVaultAccess";

type ShareRole = "viewer" | "editor" | "contributor";
type HistoryEventType =
  | "share_created"
  | "share_revoked"
  | "share_made_public"
  | "invite_sent"
  | "member_added"
  | "member_removed";

function shareToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

async function createUniqueToken(ctx: MutationCtx) {
  for (let attempts = 0; attempts < 5; attempts += 1) {
    const token = shareToken();
    const existing = await ctx.db
      .query("shares")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!existing) {
      return token;
    }
  }

  throw new ConvexError("[SHARE CREATE]: failed to generate a unique token");
}

async function createUniqueInviteToken(ctx: MutationCtx) {
  for (let attempts = 0; attempts < 5; attempts += 1) {
    const token = shareToken();
    const existing = await ctx.db
      .query("share_invites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!existing) {
      return token;
    }
  }

  throw new ConvexError("[INVITE CREATE]: failed to generate a unique token");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toMembershipRole(role: ShareRole) {
  return role === "viewer" ? "viewer" : "contributor";
}

async function logShareEvent(
  ctx: MutationCtx,
  input: {
    vaultId: Id<"vaults">;
    actorId: Id<"users">;
    shareId?: Id<"shares">;
    targetUserId?: Id<"users">;
    eventType: HistoryEventType;
    summary: string;
  }
) {
  await ctx.db.insert("history_events", {
    vault_id: input.vaultId,
    actor_id: input.actorId,
    share_id: input.shareId,
    target_user_id: input.targetUserId,
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
    action: "invite_accepted";
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

async function getOwnedShareByVault(
  ctx: MutationCtx,
  vaultId: Id<"vaults">,
  ownerId: Id<"users">
) {
  const shares = await ctx.db
    .query("shares")
    .withIndex("by_vault_id", (q) => q.eq("vault_id", vaultId))
    .collect();

  return shares.find((share) => share.shared_by === ownerId && !share.revoked_at) ?? null;
}

async function ensureOwnedShare(
  ctx: MutationCtx,
  vaultId: Id<"vaults">,
  ownerId: Id<"users">
) {
  const existing = await getOwnedShareByVault(ctx, vaultId, ownerId);
  if (existing) return existing;

  const token = await createUniqueToken(ctx);
  const now = Date.now();
  const shareId = await ctx.db.insert("shares", {
    vault_id: vaultId,
    shared_by: ownerId,
    is_public: false,
    token,
    created_at: now,
  });

  const created = await ctx.db.get(shareId);
  if (!created) {
    throw new ConvexError("[SHARE ENSURE]: share was not created");
  }

  return created;
}

function assertInviteRole(value: ShareRole) {
  if (value !== "viewer" && value !== "editor" && value !== "contributor") {
    throw new ConvexError("[SHARE INVITE]: invalid role");
  }
}

export const ensureForVault = mutation({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, { vaultId }) => {
    const { user } = await authorizeVaultAccess(ctx, vaultId);
    return await ensureOwnedShare(ctx, vaultId, user._id);
  },
});

export const setAccess = mutation({
  args: {
    vaultId: v.id("vaults"),
    isPublic: v.boolean(),
  },
  handler: async (ctx, { vaultId, isPublic }) => {
    const { user } = await authorizeVaultAccess(ctx, vaultId);
    const share = await ensureOwnedShare(ctx, vaultId, user._id);
    const token = await createUniqueToken(ctx);
    await ctx.db.patch(share._id, { is_public: isPublic, token });

    if (isPublic) {
      await logShareEvent(ctx, {
        vaultId,
        actorId: user._id,
        shareId: share._id,
        eventType: "share_made_public",
        summary: "Vault shared publicly via link",
      });
    }

    return await ctx.db.get(share._id);
  },
});

export const upsertInvite = mutation({
  args: {
    vaultId: v.id("vaults"),
    email: v.string(),
    role: v.union(
      v.literal("viewer"),
      v.literal("editor"),
      v.literal("contributor")
    ),
  },
  handler: async (ctx, { vaultId, email, role }) => {
    const { user } = await authorizeVaultAccess(ctx, vaultId);
    assertInviteRole(role);
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      throw new ConvexError("[SHARE INVITE]: email is required");
    }
    if (normalizedEmail === (user.email ?? "").toLowerCase()) {
      throw new ConvexError("[SHARE INVITE]: you already have access");
    }

    const share = await ensureOwnedShare(ctx, vaultId, user._id);
    const existing = await ctx.db
      .query("share_invites")
      .withIndex("by_share_id_email", (q) =>
        q.eq("share_id", share._id).eq("email", normalizedEmail)
      )
      .first();
    const recipient = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();
    if (recipient) {
      const existingMembership = await ctx.db
        .query("vault_memberships")
        .withIndex("by_vault_id_user_id", (q) =>
          q.eq("vault_id", vaultId).eq("user_id", recipient._id)
        )
        .first();
      if (existingMembership && !existingMembership.revoked_at) {
        throw new ConvexError("[SHARE INVITE]: user already has access");
      }
    }
    const now = Date.now();
    const token = await createUniqueInviteToken(ctx);

    if (existing) {
      await ctx.db.patch(existing._id, {
        role,
        user_id: recipient?._id,
        status: "pending",
        token,
        revoked_at: undefined,
        consumed_at: undefined,
        updated_at: now,
      });
      return await ctx.db.get(existing._id);
    }

    const inviteId = await ctx.db.insert("share_invites", {
      share_id: share._id,
      email: normalizedEmail,
      user_id: recipient?._id,
      role,
      status: "pending",
      token,
      invited_by: user._id,
      created_at: now,
      updated_at: now,
    });

    await logShareEvent(ctx, {
      vaultId,
      actorId: user._id,
      eventType: "invite_sent",
      summary: `Invited ${normalizedEmail} as ${role}`,
    });

    return await ctx.db.get(inviteId);
  },
});

export const updateInviteRole = mutation({
  args: {
    inviteId: v.id("share_invites"),
    role: v.union(
      v.literal("viewer"),
      v.literal("editor"),
      v.literal("contributor")
    ),
  },
  handler: async (ctx, { inviteId, role }) => {
    assertInviteRole(role);
    const invite = await ctx.db.get(inviteId);
    if (!invite || invite.revoked_at) {
      throw new ConvexError("[SHARE INVITE]: invite not found");
    }

    const share = await ctx.db.get(invite.share_id);
    if (!share || share.revoked_at) {
      throw new ConvexError("[SHARE INVITE]: share not found");
    }

    const { user } = await authorizeVaultAccess(ctx, share.vault_id);
    if (share.shared_by !== user._id) {
      throw new ConvexError("[SHARE INVITE]: access denied");
    }

    await ctx.db.patch(inviteId, {
      role,
      updated_at: Date.now(),
    });

    return await ctx.db.get(inviteId);
  },
});

export const removeInvite = mutation({
  args: {
    inviteId: v.id("share_invites"),
  },
  handler: async (ctx, { inviteId }) => {
    const invite = await ctx.db.get(inviteId);
    if (!invite || invite.revoked_at) {
      throw new ConvexError("[SHARE INVITE]: invite not found");
    }

    const share = await ctx.db.get(invite.share_id);
    if (!share || share.revoked_at) {
      throw new ConvexError("[SHARE INVITE]: share not found");
    }

    const { user } = await authorizeVaultAccess(ctx, share.vault_id);
    if (share.shared_by !== user._id) {
      throw new ConvexError("[SHARE INVITE]: access denied");
    }

    await ctx.db.patch(inviteId, {
      revoked_at: Date.now(),
      updated_at: Date.now(),
    });
  },
});

export const getInviteByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const invite = await ctx.db
      .query("share_invites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!invite || invite.revoked_at || invite.consumed_at) {
      throw new ConvexError("[INVITE GET]: invite not found");
    }

    const share = await ctx.db.get(invite.share_id);
    if (!share || share.revoked_at) {
      throw new ConvexError("[INVITE GET]: share not found");
    }

    const vault = await ctx.db.get(share.vault_id);
    const inviter = await ctx.db.get(invite.invited_by);
    const user = await getAuthenticatedUser(ctx);

    return {
      invite,
      vault,
      inviter,
      signedInEmail: user?.email ?? null,
      canAccept:
        Boolean(user?.email) &&
        user?.email?.trim().toLowerCase() === invite.email,
    };
  },
});

export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await authorizeUserIdentity(ctx);
    const normalizedEmail = user.email?.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new ConvexError("[INVITE ACCEPT]: user email is required");
    }

    const invite = await ctx.db
      .query("share_invites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (
      !invite ||
      invite.revoked_at ||
      invite.consumed_at ||
      invite.status !== "pending"
    ) {
      throw new ConvexError("[INVITE ACCEPT]: invite not available");
    }
    if (invite.email !== normalizedEmail) {
      throw new ConvexError("[INVITE ACCEPT]: access denied");
    }

    const share = await ctx.db.get(invite.share_id);
    if (!share || share.revoked_at) {
      throw new ConvexError("[INVITE ACCEPT]: share not available");
    }

    const now = Date.now();
    const role = toMembershipRole(invite.role);
    const existingMembership = await ctx.db
      .query("vault_memberships")
      .withIndex("by_vault_id_user_id", (q) =>
        q.eq("vault_id", share.vault_id).eq("user_id", user._id)
      )
      .first();

    if (existingMembership) {
      await ctx.db.patch(existingMembership._id, {
        role,
        invited_by: invite.invited_by,
        revoked_at: undefined,
        updated_at: now,
      });
    } else {
      await ctx.db.insert("vault_memberships", {
        vault_id: share.vault_id,
        user_id: user._id,
        role,
        invited_by: invite.invited_by,
        created_at: now,
        updated_at: now,
      });
    }

    await ctx.db.patch(invite._id, {
      user_id: user._id,
      status: "accepted",
      consumed_at: now,
      updated_at: now,
    });

    await logShareEvent(ctx, {
      vaultId: share.vault_id,
      actorId: user._id,
      targetUserId: user._id,
      shareId: share._id,
      eventType: "member_added",
      summary: `${user.email ?? user.name ?? "A member"} joined the vault`,
    });
    await touchVaultRecent(ctx, {
      userId: user._id,
      vaultId: share.vault_id,
      action: "invite_accepted",
    });

    return { vaultId: share.vault_id };
  },
});

export const declineInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await authorizeUserIdentity(ctx);
    const normalizedEmail = user.email?.trim().toLowerCase();
    const invite = await ctx.db
      .query("share_invites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (
      !invite ||
      invite.revoked_at ||
      invite.consumed_at ||
      invite.status !== "pending"
    ) {
      throw new ConvexError("[INVITE DECLINE]: invite not available");
    }
    if (!normalizedEmail || invite.email !== normalizedEmail) {
      throw new ConvexError("[INVITE DECLINE]: access denied");
    }

    await ctx.db.patch(invite._id, {
      status: "declined",
      consumed_at: Date.now(),
      updated_at: Date.now(),
    });
  },
});

export const listPendingInvites = query({
  args: {},
  handler: async (ctx) => {
    const user = await authorizeUserIdentity(ctx);
    const normalizedEmail = user.email?.trim().toLowerCase();
    if (!normalizedEmail) return [];

    const invites = await ctx.db
      .query("share_invites")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .collect();
    const pendingInvites = invites.filter(
      (invite) =>
        invite.status === "pending" && !invite.revoked_at && !invite.consumed_at
    );

    const rows = await Promise.all(
      pendingInvites.map(async (invite) => {
        const share = await ctx.db.get(invite.share_id);
        if (!share || share.revoked_at) return null;
        const vault = await ctx.db.get(share.vault_id);
        const inviter = await ctx.db.get(invite.invited_by);
        return { invite, share, vault, inviter };
      })
    );

    return rows.filter((row): row is NonNullable<typeof row> => Boolean(row));
  },
});

export const pendingInviteCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await authorizeUserIdentity(ctx);
    const normalizedEmail = user.email?.trim().toLowerCase();
    if (!normalizedEmail) return 0;

    const invites = await ctx.db
      .query("share_invites")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .collect();

    return invites.filter(
      (invite) =>
        invite.status === "pending" && !invite.revoked_at && !invite.consumed_at
    ).length;
  },
});

export const listMembers = query({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, { vaultId }) => {
    await authorizeVaultAccess(ctx, vaultId);
    const memberships = await ctx.db
      .query("vault_memberships")
      .withIndex("by_vault_id", (q) => q.eq("vault_id", vaultId))
      .collect();
    const activeMemberships = memberships.filter((row) => !row.revoked_at);

    return await Promise.all(
      activeMemberships.map(async (membership) => {
        const user = await ctx.db.get(membership.user_id);
        return { membership, user };
      })
    );
  },
});

export const removeMember = mutation({
  args: {
    vaultId: v.id("vaults"),
    userId: v.id("users"),
  },
  handler: async (ctx, { vaultId, userId }) => {
    const { user } = await authorizeVaultAccess(ctx, vaultId);
    const membership = await ctx.db
      .query("vault_memberships")
      .withIndex("by_vault_id_user_id", (q) =>
        q.eq("vault_id", vaultId).eq("user_id", userId)
      )
      .first();
    if (!membership || membership.revoked_at) {
      throw new ConvexError("[MEMBER REMOVE]: membership not found");
    }

    await ctx.db.patch(membership._id, {
      revoked_at: Date.now(),
      updated_at: Date.now(),
    });

    await logShareEvent(ctx, {
      vaultId,
      actorId: user._id,
      targetUserId: userId,
      eventType: "member_removed",
      summary: "Removed a member from the vault",
    });
  },
});

export const leaveVault = mutation({
  args: { vaultId: v.id("vaults") },
  handler: async (ctx, { vaultId }) => {
    const access = await authorizeVaultRole(ctx, vaultId, {
      requiredRole: "viewer",
    });
    if (!access.user || access.role === "owner") {
      throw new ConvexError("[MEMBER LEAVE]: access denied");
    }

    const membership = await ctx.db
      .query("vault_memberships")
      .withIndex("by_vault_id_user_id", (q) =>
        q.eq("vault_id", vaultId).eq("user_id", access.user._id)
      )
      .first();
    if (!membership || membership.revoked_at) {
      throw new ConvexError("[MEMBER LEAVE]: membership not found");
    }

    await ctx.db.patch(membership._id, {
      revoked_at: Date.now(),
      updated_at: Date.now(),
    });

    await logShareEvent(ctx, {
      vaultId,
      actorId: access.user._id,
      targetUserId: access.user._id,
      eventType: "member_removed",
      summary: `${access.user.email ?? access.user.name ?? "A member"} left the vault`,
    });
  },
});

export const listInvites = query({
  args: {
    vaultId: v.id("vaults"),
  },
  handler: async (ctx, { vaultId }) => {
    const { user } = await authorizeVaultAccess(ctx, vaultId);
    const shares = await ctx.db
      .query("shares")
      .withIndex("by_vault_id", (q) => q.eq("vault_id", vaultId))
      .collect();
    const share = shares.find((value) => value.shared_by === user._id && !value.revoked_at);
    if (!share) return [];

    const invites = await ctx.db
      .query("share_invites")
      .withIndex("by_share_id", (q) => q.eq("share_id", share._id))
      .collect();
    const filtered = invites
      .filter((invite) => !invite.revoked_at)
      .sort((a, b) => b.updated_at - a.updated_at);

    return Promise.all(
      filtered.map(async (invite) => {
        let avatar: string | null = null;
        if (invite.user_id) {
          const u = await ctx.db.get(invite.user_id);
          avatar = u?.image_url ?? null;
        }
        return { ...invite, avatar };
      }),
    );
  },
});

export const getMineForVault = query({
  args: {
    vaultId: v.id("vaults"),
  },
  handler: async (ctx, { vaultId }) => {
    const { user } = await authorizeVaultAccess(ctx, vaultId);
    const shares = await ctx.db
      .query("shares")
      .withIndex("by_vault_id", (q) => q.eq("vault_id", vaultId))
      .collect();
    const share = shares.find((value) => value.shared_by === user._id && !value.revoked_at);
    if (!share) {
      return null;
    }

    const invites = await ctx.db
      .query("share_invites")
      .withIndex("by_share_id", (q) => q.eq("share_id", share._id))
      .collect();
    return {
      share,
      invites: invites.filter((invite) => !invite.revoked_at),
    };
  },
});

export const create = mutation({
  args: {
    vaultId: v.id("vaults"),
    mode: v.union(v.literal("public"), v.literal("private")),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { vaultId, mode, email }) => {
    const { user } = await authorizeVaultAccess(ctx, vaultId);
    const share = await ensureOwnedShare(ctx, vaultId, user._id);
    const isPublic = mode === "public";
    await ctx.db.patch(share._id, {
      is_public: isPublic,
      token: await createUniqueToken(ctx),
    });

    if (mode === "private") {
      const normalizedEmail = normalizeEmail(email ?? "");
      if (!normalizedEmail) {
        throw new ConvexError("[SHARE CREATE]: email is required for private share");
      }

      const recipient = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .first();
      const existing = await ctx.db
        .query("share_invites")
        .withIndex("by_share_id_email", (q) =>
          q.eq("share_id", share._id).eq("email", normalizedEmail)
        )
        .first();
      const now = Date.now();
      const token = await createUniqueInviteToken(ctx);

      if (existing) {
        await ctx.db.patch(existing._id, {
          user_id: recipient?._id,
          status: "pending",
          role: "contributor",
          token,
          revoked_at: undefined,
          consumed_at: undefined,
          updated_at: now,
        });
      } else {
        await ctx.db.insert("share_invites", {
          share_id: share._id,
          email: normalizedEmail,
          user_id: recipient?._id,
          role: "contributor",
          status: "pending",
          token,
          invited_by: user._id,
          created_at: now,
          updated_at: now,
        });
      }
    }

    return await ctx.db.get(share._id);
  },
});

export const revoke = mutation({
  args: { shareId: v.id("shares") },
  handler: async (ctx, { shareId }) => {
    const user = await authorizeUserIdentity(ctx);
    const share = await ctx.db.get(shareId);
    if (!share) {
      throw new ConvexError("[SHARE REVOKE]: share not found");
    }

    if (share.shared_by !== user._id) {
      throw new ConvexError("[SHARE REVOKE]: access denied");
    }

    await ctx.db.patch(shareId, { revoked_at: Date.now() });
  },
});

export const listReceived = query({
  args: {},
  handler: async (ctx) => {
    const user = await authorizeUserIdentity(ctx);
    const memberships = await ctx.db
      .query("vault_memberships")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();
    const activeMemberships = memberships.filter((row) => !row.revoked_at);

    const normalizedEmail = user.email?.trim().toLowerCase();
    const userInvites = normalizedEmail
      ? await ctx.db
          .query("share_invites")
          .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
          .collect()
      : [];
    const linkedInvites = userInvites.filter(
      (invite) =>
        !invite.revoked_at &&
        !invite.consumed_at &&
        (invite.status === "active" || invite.status === "accepted")
    );
    const invitedShares = await Promise.all(
      linkedInvites.map((invite) => ctx.db.get(invite.share_id))
    );
    const legacyDirectShares = await ctx.db
      .query("shares")
      .withIndex("by_shared_with", (q) => q.eq("shared_with", user._id))
      .collect();
    const shareMap = new Map(
      [...invitedShares, ...legacyDirectShares]
        .filter((row): row is NonNullable<typeof row> => Boolean(row && !row.revoked_at))
        .map((row) => [row._id, row])
    );
    const shares = [...shareMap.values()];

    const membershipRows = await Promise.all(
      activeMemberships.map(async (membership) => {
        const vault = await ctx.db.get(membership.vault_id);
        if (!vault) return null;
        const shares = await ctx.db
          .query("shares")
          .withIndex("by_vault_id", (q) => q.eq("vault_id", membership.vault_id))
          .collect();
        const share = shares.find((row) => !row.revoked_at) ?? null;
        const sharer = await ctx.db.get(vault.owner_id);
        return {
          membership,
          share,
          vault,
          sharer,
          role: membership.role,
          status: "accepted" as const,
        };
      })
    );

    const legacyRows = await Promise.all(
      shares.map(async (share) => {
        const vault = await ctx.db.get(share.vault_id);
        const sharer = await ctx.db.get(share.shared_by);
        const invite = linkedInvites.find((item) => item.share_id === share._id);
        return {
          share,
          vault,
          sharer,
          role: invite ? toMembershipRole(invite.role) : "contributor",
          status: "accepted" as const,
        };
      })
    );

    const seenVaults = new Set<string>();
    const rows = [];
    for (const row of [...membershipRows, ...legacyRows]) {
      if (!row?.vault) continue;
      const id = row.vault._id as string;
      if (seenVaults.has(id)) continue;
      seenVaults.add(id);
      rows.push({ ...row, vault: row.vault });
    }
    return rows;
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await authorizeUserIdentity(ctx);
    return await ctx.db
      .query("shares")
      .withIndex("by_shared_by", (q) => q.eq("shared_by", user._id))
      .collect();
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const share = await ctx.db
      .query("shares")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!share) {
      throw new ConvexError("[SHARE GET]: share not found");
    }
    if (share.revoked_at || !share.is_public) {
      throw new ConvexError("[SHARE GET]: share not available");
    }

    const access = await authorizeShareAccess(ctx, share);

    const vault = await ctx.db.get(share.vault_id);
    const sharer = await ctx.db.get(share.shared_by);

    return {
      share,
      vault,
      sharer,
      accessRole: access.role,
      canEdit: false,
    };
  },
});

export const listHistory = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const share = await ctx.db
      .query("shares")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!share) {
      throw new ConvexError("[SHARE HISTORY]: share not found");
    }

    const access = await authorizeShareAccess(ctx, share);
    if (!access.user) {
      throw new ConvexError("[SHARE HISTORY]: access denied");
    }

    const historyRows = await ctx.db
      .query("history_events")
      .withIndex("by_vault_id", (q) => q.eq("vault_id", share.vault_id))
      .collect();

    const EVENT_LABELS: Record<string, string> = {
      link_added: "Link saved",
      link_updated: "Link edited",
      link_deleted: "Link removed",
      vault_updated: "Vault edited",
      shared_link_added: "Link saved",
      shared_link_removed: "Link removed",
      share_made_public: "Shared publicly",
      invite_sent: "Contributor invited",
    };

    const events = await Promise.all(
      historyRows.map(async (row) => {
        const actor = await ctx.db.get(row.actor_id);
        return {
          id: row._id as string,
          type: row.event_type,
          humanType: EVENT_LABELS[row.event_type] ?? row.event_type.replace(/_/g, " "),
          at: row.created_at,
          by: actor?.email ?? actor?.name ?? "Unknown",
          byUserId: row.actor_id as string,
          byAvatar: actor?.image_url ?? null,
          linkTitle: row.summary,
        };
      }),
    );

    return events.sort((a, b) => b.at - a.at);
  },
});
