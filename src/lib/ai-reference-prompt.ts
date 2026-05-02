export type AiReferenceLink = {
  title: string;
  url: string;
  description?: string;
  category: string;
};

function normalizeCategory(input: string) {
  const trimmed = input.trim();
  return trimmed || "Other";
}

export function buildAiReferencePrompt(input: {
  vaultName: string;
  links: AiReferenceLink[];
}) {
  const vaultName = input.vaultName.trim() || "Untitled Vault";

  const byCategory = new Map<string, AiReferenceLink[]>();
  for (const link of input.links) {
    const category = normalizeCategory(link.category);
    const list = byCategory.get(category) ?? [];
    list.push(link);
    byCategory.set(category, list);
  }

  const categories = [...byCategory.keys()].sort((a, b) =>
    a.localeCompare(b),
  );

  const lines: string[] = [];
  lines.push("Here is a reference set you must follow.");
  lines.push("");
  lines.push(`Vault: ${vaultName}`);
  lines.push("");

  for (const category of categories) {
    lines.push(`## ${category}`);
    const links = (byCategory.get(category) ?? []).slice(0);
    links.sort((a, b) => a.title.localeCompare(b.title));
    for (const link of links) {
      const title = link.title?.trim() || link.url;
      lines.push(`- ${title} — ${link.url}`);
      const desc = link.description?.trim();
      if (desc) {
        lines.push(`  - ${desc}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

export function buildCursorPromptDeeplink(promptText: string) {
  const base = "cursor://anysphere.cursor-deeplink/prompt";
  const url = new URL(base);
  url.searchParams.set("text", promptText);
  return url.toString();
}

export function buildCursorPromptWebLink(promptText: string) {
  const base = "https://cursor.com/link/prompt";
  const url = new URL(base);
  url.searchParams.set("text", promptText);
  return url.toString();
}

export function buildChatGptPrefillUrl(promptText: string) {
  const url = new URL("https://chatgpt.com/");
  url.searchParams.set("q", promptText);
  return url.toString();
}

export function buildClaudePrefillUrl(promptText: string) {
  const url = new URL("https://claude.ai/new");
  url.searchParams.set("q", promptText);
  return url.toString();
}

export const SAFE_URL_LENGTH = 8000;

export type AiProvider = {
  id: string;
  label: string;
  buildUrl: (prompt: string) => string;
  fallbackBaseUrl: string;
};

export const AI_PROVIDERS: AiProvider[] = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    buildUrl: buildChatGptPrefillUrl,
    fallbackBaseUrl: "https://chatgpt.com/",
  },
  {
    id: "claude",
    label: "Claude",
    buildUrl: buildClaudePrefillUrl,
    fallbackBaseUrl: "https://claude.ai/new",
  },
  {
    id: "cursor",
    label: "Cursor",
    buildUrl: buildCursorPromptDeeplink,
    fallbackBaseUrl: "https://cursor.com/",
  },
];

