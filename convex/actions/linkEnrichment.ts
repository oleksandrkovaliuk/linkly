"use node";

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { categorizeLink } from "../lib/categorizeLink";
import { extractMetadata } from "../lib/extractMetadata";

export const enrichLink = internalAction({
  args: {
    linkId: v.id("links"),
  },
  handler: async (ctx, { linkId }) => {
    try {
      const link = await ctx.runQuery(internal.links.getLinkById, {
        linkId,
      });
      if (!link) return;

      const metadata = await extractMetadata(link.url);
      const category = await categorizeLink({
        title: metadata.title,
        description: metadata.description,
      });

      await ctx.runMutation(internal.links.patchMetadata, {
        linkId,
        title: metadata.title || link.url,
        description: metadata.description,
        favicon: metadata.favicon,
        image: metadata.image,
        category,
      });
    } catch {
      await ctx.runMutation(internal.links.markEnrichmentError, { linkId });
    }
  },
});
