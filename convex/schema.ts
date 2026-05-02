import { typedV } from "convex-helpers/validators";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  users: defineTable({
    clerk_id: v.nullable(v.string()),
    name: v.nullable(v.string()),
    email: v.nullable(v.string()),
    last_name: v.nullable(v.string()),
    first_name: v.nullable(v.string()),
    image_url: v.nullable(v.string()),
  })
    .index("by_clerk_id", ["clerk_id"])
    .index("by_email", ["email"]),

  vaults: defineTable({
    owner_id: v.id("users"),
    name: v.string(),
    color: v.optional(v.string()),
    emoji: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
  }).index("by_owner_id", ["owner_id"]),

  links: defineTable({
    owner_id: v.id("users"),
    url: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    favicon: v.optional(v.string()),
    image: v.optional(v.string()),
    category: v.string(),
    enrichment_status: v.union(
      v.literal("pending"),
      v.literal("ready"),
      v.literal("error")
    ),
    searchable_text: v.string(),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_owner_id", ["owner_id"])
    .searchIndex("search_links", {
      searchField: "searchable_text",
      filterFields: ["owner_id"],
    }),

  vault_links: defineTable({
    vault_id: v.id("vaults"),
    link_id: v.id("links"),
    added_by: v.id("users"),
    added_at: v.number(),
    pinned_at: v.optional(v.number()),
    pinned_by: v.optional(v.id("users")),
  })
    .index("by_vault_id", ["vault_id"])
    .index("by_link_id", ["link_id"]),

  vault_memberships: defineTable({
    vault_id: v.id("vaults"),
    user_id: v.id("users"),
    role: v.union(v.literal("viewer"), v.literal("contributor")),
    invited_by: v.optional(v.id("users")),
    created_at: v.number(),
    updated_at: v.number(),
    revoked_at: v.optional(v.number()),
  })
    .index("by_vault_id", ["vault_id"])
    .index("by_user_id", ["user_id"])
    .index("by_vault_id_user_id", ["vault_id", "user_id"]),

  shares: defineTable({
    vault_id: v.id("vaults"),
    shared_by: v.id("users"),
    shared_with: v.optional(v.id("users")),
    is_public: v.boolean(),
    token: v.string(),
    created_at: v.number(),
    revoked_at: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_shared_by", ["shared_by"])
    .index("by_shared_with", ["shared_with"])
    .index("by_vault_id", ["vault_id"]),

  share_invites: defineTable({
    share_id: v.id("shares"),
    email: v.string(),
    user_id: v.optional(v.id("users")),
    role: v.union(
      v.literal("viewer"),
      v.literal("editor"),
      v.literal("contributor")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("accepted"),
      v.literal("declined")
    ),
    token: v.optional(v.string()),
    invited_by: v.id("users"),
    created_at: v.number(),
    updated_at: v.number(),
    consumed_at: v.optional(v.number()),
    revoked_at: v.optional(v.number()),
  })
    .index("by_share_id", ["share_id"])
    .index("by_email", ["email"])
    .index("by_token", ["token"])
    .index("by_share_id_email", ["share_id", "email"]),

  shared_vault_links: defineTable({
    share_id: v.id("shares"),
    link_id: v.id("links"),
    added_by: v.id("users"),
    added_at: v.number(),
  })
    .index("by_share_id", ["share_id"])
    .index("by_link_id", ["link_id"]),

  link_views: defineTable({
    link_id: v.id("links"),
    user_id: v.id("users"),
    viewed_at: v.number(),
  })
    .index("by_link_id", ["link_id"])
    .index("by_link_id_user_id", ["link_id", "user_id"]),

  vault_recents: defineTable({
    user_id: v.id("users"),
    vault_id: v.id("vaults"),
    last_active_at: v.number(),
    last_action: v.union(
      v.literal("vault_opened"),
      v.literal("link_viewed"),
      v.literal("link_added"),
      v.literal("link_removed"),
      v.literal("link_pinned"),
      v.literal("link_unpinned"),
      v.literal("invite_accepted")
    ),
  })
    .index("by_user_id", ["user_id"])
    .index("by_user_id_vault_id", ["user_id", "vault_id"]),

  history_events: defineTable({
    vault_id: v.id("vaults"),
    actor_id: v.id("users"),
    event_type: v.union(
      v.literal("vault_created"),
      v.literal("vault_updated"),
      v.literal("vault_deleted"),
      v.literal("link_added"),
      v.literal("link_updated"),
      v.literal("link_deleted"),
      v.literal("link_removed"),
      v.literal("link_viewed"),
      v.literal("member_added"),
      v.literal("member_removed"),
      v.literal("share_created"),
      v.literal("share_revoked"),
      v.literal("share_made_public"),
      v.literal("invite_sent"),
      v.literal("shared_link_added"),
      v.literal("shared_link_removed")
    ),
    summary: v.string(),
    link_id: v.optional(v.id("links")),
    share_id: v.optional(v.id("shares")),
    target_user_id: v.optional(v.id("users")),
    target_title: v.optional(v.string()),
    target_url: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_vault_id", ["vault_id"])
    .index("by_actor_id", ["actor_id"])
    .index("by_created_at", ["created_at"]),
});

export const vv = typedV(schema);

export default schema;
