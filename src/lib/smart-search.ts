type SmartSearchOptions = {
  /**
   * Minimum score to include in results. Keep at 1+ to avoid returning
   * irrelevant items when query is present.
   */
  minScore?: number;
  /**
   * Maximum number of results to return.
   */
  limit?: number;
};

function normalize(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function splitTerms(query: string) {
  const normalized = normalize(query);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

function isSubsequence(needle: string, haystack: string) {
  if (!needle) return true;
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j += 1) {
    if (haystack[j] === needle[i]) i += 1;
  }
  return i === needle.length;
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length;
  const n = b.length;
  const dp = new Array<number>(n + 1);
  for (let j = 0; j <= n; j += 1) dp[j] = j;
  for (let i = 1; i <= m; i += 1) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const tmp = dp[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(
        dp[j]! + 1,
        dp[j - 1]! + 1,
        prev + cost,
      );
      prev = tmp;
    }
  }
  return dp[n]!;
}

function expandTerm(term: string) {
  // Lightweight synonyms mainly for categories/types.
  const map: Record<string, string> = {
    tech: "technology",
    dev: "technology",
    coding: "technology",
    tools: "technology",
    design: "design",
    ai: "ai",
  };
  return map[term] ? [term, map[term]!] : [term];
}

function scoreTermInText(term: string, text: string, weight: number) {
  if (!term || !text) return 0;
  const t = normalize(text);
  if (!t) return 0;

  // Strong signals.
  if (t === term) return 120 * weight;
  if (t.includes(term)) return 100 * weight;

  // Token-level signals.
  const tokens = t.split(/[^a-z0-9]+/g).filter(Boolean);
  if (tokens.some((tok) => tok.startsWith(term))) return 70 * weight;
  if (tokens.some((tok) => isSubsequence(term, tok))) return 35 * weight;

  // Small typo tolerance for short-ish terms.
  if (term.length >= 3 && term.length <= 18) {
    let best = Infinity;
    for (const tok of tokens) {
      if (Math.abs(tok.length - term.length) > 2) continue;
      best = Math.min(best, levenshtein(term, tok));
      if (best === 0) break;
    }
    if (best === 1) return 20 * weight;
    if (best === 2) return 10 * weight;
  }

  return 0;
}

export function smartSearch<T>(
  items: T[],
  query: string,
  getSearchParts: (item: T) => {
    title?: string;
    category?: string;
    description?: string;
    url?: string;
    extra?: string[];
  },
  options: SmartSearchOptions = {},
) {
  const terms = splitTerms(query).flatMap(expandTerm);
  if (terms.length === 0) {
    return options.limit ? items.slice(0, options.limit) : items;
  }

  const minScore = options.minScore ?? 1;
  const scored = items
    .map((item) => {
      const parts = getSearchParts(item);
      const extra = parts.extra?.join(" ") ?? "";

      let score = 0;
      for (const term of terms) {
        score += scoreTermInText(term, parts.title ?? "", 1.25);
        score += scoreTermInText(term, parts.category ?? "", 1.15);
        score += scoreTermInText(term, parts.description ?? "", 0.85);
        score += scoreTermInText(term, parts.url ?? "", 0.7);
        score += scoreTermInText(term, extra, 0.6);
      }

      return { item, score };
    })
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.item);

  return options.limit ? scored.slice(0, options.limit) : scored;
}

