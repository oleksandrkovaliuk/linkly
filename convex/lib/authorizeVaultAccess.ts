import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type AccessCtx = QueryCtx | MutationCtx;
export type VaultAccessRole =
  | "owner"
  | "contributor"
  | "viewer"
  | "public_viewer";
export type RequiredVaultRole = "owner" | "contributor" | "viewer";

const ROLE_RANK: Record<VaultAccessRole, number> = {
  public_viewer: 0,
  viewer: 0,
  contributor: 1,
  owner: 2,
};

function canSatisfy(role: VaultAccessRole, requiredRole: RequiredVaultRole) {
  return ROLE_RANK[role] >= ROLE_RANK[requiredRole];
}

function normalizeStoredRole(role: "viewer" | "editor" | "contributor") {
  return role === "viewer" ? "viewer" : "contributor";
}

export async function getAuthenticatedUser(
  ctx: AccessCtx
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerk_id", identity.subject))
    .first();
}

async function getLegacyInviteAccess(
  ctx: AccessCtx,
  vaultId: Id<"vaults">,
  user: Doc<"users">
): Promise<VaultAccessRole | null> {
  const shares = await ctx.db
    .query("shares")
    .withIndex("by_vault_id", (q) => q.eq("vault_id", vaultId))
    .collect();
  const activeShares = shares.filter((share) => !share.revoked_at);

  for (const share of activeShares) {
    if (share.shared_with === user._id) {
      return "contributor";
    }
  }

  const normalizedEmail = user.email?.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const invites = await ctx.db
    .query("share_invites")
    .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
    .collect();

  const shareIds = new Set(activeShares.map((share) => share._id as string));
  const invite = invites.find((value) => {
    if (value.revoked_at || value.status === "pending" || value.status === "declined") {
      return false;
    }
    return shareIds.has(value.share_id as string);
  });

  return invite ? normalizeStoredRole(invite.role) : null;
}

export async function resolveVaultAccess(
  ctx: AccessCtx,
  vaultId: Id<"vaults">,
  options?: {
    publicToken?: string;
  }
) {
  const vault = await ctx.db.get(vaultId);

  if (!vault) {
    throw new ConvexError("[VAULT ACCESS]: vault not found");
  }

  const user = await getAuthenticatedUser(ctx);

  if (user && vault.owner_id === user._id) {
    return { user, vault, role: "owner" as const };
  }

  if (user) {
    const membership = await ctx.db
      .query("vault_memberships")
      .withIndex("by_vault_id_user_id", (q) =>
        q.eq("vault_id", vaultId).eq("user_id", user._id)
      )
      .first();

    if (membership && !membership.revoked_at) {
      return { user, vault, role: membership.role };
    }

    const legacyRole = await getLegacyInviteAccess(ctx, vaultId, user);
    if (legacyRole) {
      return { user, vault, role: legacyRole };
    }
  }

  const publicToken = options?.publicToken;
  if (publicToken) {
    const share = await ctx.db
      .query("shares")
      .withIndex("by_token", (q) => q.eq("token", publicToken))
      .first();

    if (
      share &&
      !share.revoked_at &&
      share.is_public &&
      share.vault_id === vaultId
    ) {
      return { user: null, vault, role: "public_viewer" as const };
    }
  }

  throw new ConvexError("[VAULT ACCESS]: access denied");
}

export async function authorizeVaultRole(
  ctx: AccessCtx,
  vaultId: Id<"vaults">,
  options?: {
    requiredRole?: RequiredVaultRole;
    publicToken?: string;
  }
) {
  const requiredRole = options?.requiredRole ?? "viewer";
  const access = await resolveVaultAccess(ctx, vaultId, options);

  if (!canSatisfy(access.role, requiredRole)) {
    throw new ConvexError("[VAULT ACCESS]: access denied");
  }

  return access;
}

export async function authorizeVaultAccess(
  ctx: AccessCtx,
  vaultId: Id<"vaults">
) {
  const access = await authorizeVaultRole(ctx, vaultId, {
    requiredRole: "owner",
  });
  if (!access.user) {
    throw new ConvexError("[VAULT ACCESS]: access denied");
  }
  return { ...access, user: access.user, role: "owner" as const };
}
