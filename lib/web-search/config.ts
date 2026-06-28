export function isWebSearchEnabled(): boolean {
  return process.env.LLM_WEB_SEARCH_ENABLED === "true";
}

export function getWebSearchMaxRounds(): number {
  const n = parseInt(process.env.LLM_WEB_SEARCH_MAX_ROUNDS || "3", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 3;
}

export function getWebSearchMaxResults(): number {
  const n = parseInt(process.env.LLM_WEB_SEARCH_MAX_RESULTS || "5", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 5;
}

export function getMiniMaxSearchConfig(): { apiKey: string; baseURL: string } {
  const apiKey =
    process.env.MINIMAX_SEARCH_API_KEY ||
    process.env.LLM_API_KEY ||
    "";
  let baseURL =
    process.env.MINIMAX_SEARCH_BASE_URL ||
    process.env.LLM_BASE_URL ||
    "https://api.minimaxi.com";
  baseURL = baseURL.replace(/\/+$/, "");
  // coding_plan/search 挂在域名根下，不在 /v1 或 /anthropic 路径里
  baseURL = baseURL.replace(/\/anthropic$/, "").replace(/\/v1$/, "");
  return { apiKey, baseURL };
}

export type FallbackProvider = "tavily" | "serper" | "none";

export function getFallbackSearchConfig(): {
  provider: FallbackProvider;
  apiKey: string;
} {
  const provider = (process.env.WEB_SEARCH_FALLBACK_PROVIDER || "none") as FallbackProvider;
  const apiKey = process.env.WEB_SEARCH_FALLBACK_API_KEY || "";
  return { provider, apiKey };
}
