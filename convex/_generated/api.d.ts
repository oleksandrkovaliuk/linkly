/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_linkEnrichment from "../actions/linkEnrichment.js";
import type * as history from "../history.js";
import type * as lib_authorizeShareAccess from "../lib/authorizeShareAccess.js";
import type * as lib_authorizeUserIdentity from "../lib/authorizeUserIdentity.js";
import type * as lib_authorizeVaultAccess from "../lib/authorizeVaultAccess.js";
import type * as lib_categorizeLink from "../lib/categorizeLink.js";
import type * as lib_extractMetadata from "../lib/extractMetadata.js";
import type * as links from "../links.js";
import type * as sharedVaultLinks from "../sharedVaultLinks.js";
import type * as shares from "../shares.js";
import type * as users from "../users.js";
import type * as vaults from "../vaults.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "actions/linkEnrichment": typeof actions_linkEnrichment;
  history: typeof history;
  "lib/authorizeShareAccess": typeof lib_authorizeShareAccess;
  "lib/authorizeUserIdentity": typeof lib_authorizeUserIdentity;
  "lib/authorizeVaultAccess": typeof lib_authorizeVaultAccess;
  "lib/categorizeLink": typeof lib_categorizeLink;
  "lib/extractMetadata": typeof lib_extractMetadata;
  links: typeof links;
  sharedVaultLinks: typeof sharedVaultLinks;
  shares: typeof shares;
  users: typeof users;
  vaults: typeof vaults;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
