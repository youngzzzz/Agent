import { getMiniMaxSearchConfig, getWebSearchMaxResults } from "@/lib/web-search/config";

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

function normalizeHits(data: any, maxResults: number): SearchHit[] {
  const raw =
    data?.results ??
    data?.data?.results ??
    data?.organic ??
    data?.search_results ??
    data?.items ??
    [];

  if (!Array.isArray(raw)) return [];

  return raw.slice(0, maxResults).map((item: any) => ({
    title: String(item.title ?? item.name ?? item.headline ?? "无标题"),
    url: String(item.url ?? item.link ?? item.uri ?? ""),
    snippet: String(item.snippet ?? item.description ?? item.content ?? item.summary ?? ""),
  }));
}

function formatHits(hits: SearchHit[]): string {
  if (!hits.length) return "未找到相关结果。";
  return hits
    .map(
      (h, i) =>
        `[${i + 1}] ${h.title}\nURL: ${h.url || "—"}\n摘要: ${h.snippet || "—"}`,
    )
    .join("\n\n");
}

/** MiniMax Token Plan Search API */
export async function searchMiniMax(query: string): Promise<string> {
  const { apiKey, baseURL } = getMiniMaxSearchConfig();
  if (!apiKey) {
    throw new Error("MiniMax 联网搜索需要 MINIMAX_SEARCH_API_KEY 或 LLM_API_KEY");
  }

  const maxResults = getWebSearchMaxResults();
  const url = `${baseURL}/v1/coding_plan/search`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, count: maxResults }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    // 部分文档用 q 字段
    if (res.status === 400 || res.status === 422) {
      const retry = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ q: query, count: maxResults }),
        signal: AbortSignal.timeout(60_000),
      });
      if (retry.ok) {
        const data = await retry.json();
        return formatHits(normalizeHits(data, maxResults));
      }
    }
    throw new Error(`MiniMax Search HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  return formatHits(normalizeHits(data, maxResults));
}
