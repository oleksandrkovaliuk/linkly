# Vault Access Refactor Plan

This plan tracks the production hardening and architecture refactor for Linkly vault access. The goal is to make private sharing safe, make the vault experience sustainable as the product grows, and organize the code around product modules that are easy for humans and LLMs to navigate.

## Product Decisions

- Private vaults are identity-bound. A URL alone never grants private vault access.
- Private invite tokens are temporary decision links only. After accept or decline, the token is consumed.
- Accepted private access becomes durable membership on the original vault.
- Public sharing remains a vault setting. Anonymous public access is view-only through a public token URL.
- Turning public sharing off invalidates the public token immediately. Turning it back on creates a fresh token.
- Owned vaults and accepted shared vaults live under `/vaults`.
- `/my-vaults` and `/shared-with-me` will be removed or redirected after replacement.
- `/` becomes a signed-in dashboard with recent vault activity, inbox preview, and quick actions.
- `/vaults` becomes the full vault hub with owned vaults, accepted shared vaults, and pending invitations.
- `/vaults/$vaultId` is the signed-in route for owners, contributors, and viewers.
- Private invite decision links use a separate route, such as `/invite/$token`.
- Public anonymous links use a separate route, such as `/public/$token`.
- Owner authority stays on `vaults.owner_id`; memberships store non-owner access only.
- Contributors can add links, edit link metadata, remove any link in the vault, pin links, and update vault presentation.
- Contributors cannot delete the vault, manage users, manage invites, or change public access.
- Members can leave shared vaults. Removing a member does not remove links they added.
- Links stay vault-local as they are today. Creator and adder fields are attribution, not authority.
- History is intentionally narrow: link viewed, member added, member removed, link added, link removed.
- History should be human-readable from structured facts, not only stored summary strings.
- Link pinning is shared by everyone in the vault and sorted by most recently pinned.
- Dashboard recents mean vaults where the current user has been active lately.
- Inbox ping is a pending invite count.
- UI must follow Linkly's current visual system and component style. Do not use generic GPT dashboard templates. New screens should be bold, product-specific, cohesive, and accessible.

## Target Modules

- `VaultAccess`: owner, membership, contributor, viewer, and public-token authorization.
- `VaultInvites`: temporary invite decision lifecycle.
- `VaultMemberships`: durable accepted access for non-owner users.
- `VaultInbox`: owned vaults, accepted shared vaults, pending invitations, and pending count.
- `VaultLinks`: vault-scoped link add, edit, remove, pin, list, and view recording.
- `VaultActivity`: per-user recents and human-readable history events.
- `PublicVaultAccess`: anonymous view-only access through active public token.

## Phased Work

### Phase 1: Data Model and Access Modules

- Add durable memberships to `convex/schema.ts`.
- Add temporary invite decision token state.
- Keep compatibility with existing share and invite data while the app migrates.
- Replace owner-only authorization assumptions with a deeper vault access module.
- Preserve a separate public-token path that can never satisfy edit mutations.

### Phase 2: Invite Inbox and Membership Lifecycle

- Refactor invite creation, listing, accept, decline, and token consumption.
- Accepting an invite creates a membership row and records `member_added`.
- Declining consumes the token without creating access.
- Removing a member revokes membership, records `member_removed`, and leaves links intact.
- Add pending invite count and inbox list queries.

### Phase 3: Vault Links, Permissions, Pins, and Recents

- Authorize vault-scoped link mutations through vault access, not link creator alone.
- Allow contributors to add, edit, remove any link in the vault, and update presentation.
- Block contributors from deletion and access management.
- Add shared pin state on `vault_links`, sorted by newest `pinned_at`.
- Add per-user vault recents updated by meaningful activity.

### Phase 4: Human-Readable Activity History

- Narrow history writes and reads to the chosen event set.
- Store structured facts needed for display.
- Render history copy such as "Sasha added example.com" or "Maria joined the vault."
- Stop relying on free-form `summary` as the only display source.

### Phase 5: TanStack Router Information Architecture

- Move the current `/my-vaults` tree to `/vaults`.
- Replace the authenticated `/` redirect with the dashboard.
- Remove or redirect `/shared-with-me` after inbox behavior moves into dashboard and `/vaults`.
- Split token routes by purpose: invite decision and public view-only.
- Use TanStack Router context and route guards for signed-in `/vaults` routes instead of repeating auth checks in every component.

### Phase 6: Dashboard, Vault Hub, and UI Polish

- Update sidebar navigation to Dashboard and Vaults with inbox pending count.
- Update create-vault and command-palette navigation to `/vaults/$vaultId`.
- Build dashboard sections: recent activity vaults, inbox preview, and quick actions.
- Build `/vaults` cards with Owned, Shared, and Invitation badges.
- Add Accept and Decline actions for invitation cards.
- Audit existing Linkly components and tokens before building new UI. New work should feel native to this app, not like default template UI.

### Phase 7: Verification and Cleanup

- Verify private URL without membership cannot access vault data.
- Verify invite token only works for accept or decline and stops working afterward.
- Verify accepted members open `/vaults/$vaultId`.
- Verify contributors can manage content and presentation but cannot manage access or delete vaults.
- Verify public token allows anonymous view-only access and stops immediately when public sharing is disabled.
- Verify inbox count matches pending invites.
- Verify pins sort newest first.
- Verify recents are scoped to the current user.
- Remove legacy private shared-token and shared-with-me flows after replacement is proven.

## GitHub Issue Breakdown

1. [Introduce vault memberships and centralized access checks](https://github.com/oleksandrkovaliuk/linkly/issues/1).
2. [Build invite inbox and accept/decline lifecycle](https://github.com/oleksandrkovaliuk/linkly/issues/2).
3. [Refactor vault link permissions, shared pinning, and per-user recents](https://github.com/oleksandrkovaliuk/linkly/issues/3).
4. [Narrow and humanize vault activity history](https://github.com/oleksandrkovaliuk/linkly/issues/4).
5. [Move routing to dashboard, `/vaults`, invite, and public routes](https://github.com/oleksandrkovaliuk/linkly/issues/5).
6. [Build dashboard and vault hub in the Linkly visual system](https://github.com/oleksandrkovaliuk/linkly/issues/6).
7. [Verify production safety flows and remove legacy sharing paths](https://github.com/oleksandrkovaliuk/linkly/issues/7).

## Draft PR Operating Notes

- The first PR is intentionally a draft planning PR.
- Implementation should proceed issue by issue.
- Use Cursor agents during execution for focused parallel review:
  - backend/security review
  - frontend/routing review
  - verification/test review
- Keep the draft PR body updated with issue links, progress, test results, and any behavior changes.
