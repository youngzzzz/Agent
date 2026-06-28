import { getFallbackSearchConfig, getWebSearchMaxResults } from "@/lib/web-search/config";

async function searchTavily(query: string, apiKey: string, maxResults: number): Promise<string> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: "basic",
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tavily HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const results = data?.results ?? [];
  if (!Array.isArray(results) || !results.length) return "未找到相关结果。";

  return results
    .slice(0, maxResults)
    .map(
      (r: any, i: number) =>
        `[${i + 1}] ${r.title ?? "无标题"}\nURL: ${r.url ?? "—"}\n摘要: ${r.content ?? r.snippet ?? "—"}`,
    )
    .join("\n\n");
}

async function searchSerper(query: string, apiKey: string, maxResults: number): Promise<string> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({ q: query, num: maxResults }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Serper HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const organic = data?.organic ?? [];
  if (!Array.isArray(organic) || !organic.length) return "未找到相关结果。";

  return organic
    .slice(0, maxResults)
    .map(
      (r: any, i: number) =>
        `[${i + 1}] ${r.title ?? "无标题"}\nURL: ${r.link ?? "—"}\n摘要: ${r.snippet ?? "—"}`,
    )
    .join("\n\n");
}

export async function searchFallback(query: string): Promise<string> {
  const { provider, apiKey } = getFallbackSearchConfig();
  const maxResults = getWebSearchMaxResults();

  if (provider === "none" || !apiKey) {
    throw new Error(
      "未配置第三方搜索：请设置 WEB_SEARCH_FALLBACK_PROVIDER 与 WEB_SEARCH_FALLBACK_API_KEY",
    );
  }

  if (provider === "tavily") return searchTavily(query, apiKey, maxResults);
  if (provider === "serper") return searchSerper(query, apiKey, maxResults);

  throw new Error(`不支持的 WEB_SEARCH_FALLBACK_PROVIDER: ${provider}`);
}
