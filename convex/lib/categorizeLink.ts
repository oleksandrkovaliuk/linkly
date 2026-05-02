import { google } from "@ai-sdk/google";
import { tryCatch } from "~/lib/try-catch";
import { generateText } from "ai";

export async function categorizeLink(metadata: {
  title?: string;
  description?: string;
}): Promise<string> {
  const [error, response] = await tryCatch(
    generateText({
      model: google("gemini-2.0-flash"),
      prompt: `Categorize this link into one of these categories: Technology, News, Education, Entertainment, Business, Health, Sports, Travel, Food, or come up with your own category.

Title: ${metadata.title}
Description: ${metadata.description || "No description"}

Return only the category name:`,
      temperature: 0.1,
      maxOutputTokens: 100,
    })
  );

  if (error) {
    throw error;
  }

  return response.text.trim() || "Other";
}
