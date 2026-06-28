import { searchFallback } from "@/lib/web-search/providers/fallback";
import { searchMiniMax } from "@/lib/web-search/providers/minimax";
import { WebSearchStrategy } from "@/lib/web-search/strategy";

export async function executeWebSearch(
  query: string,
  strategy: WebSearchStrategy,
): Promise<string> {
  const q = query.trim();
  if (!q) return "搜索词为空。";

  try {
    if (strategy === "minimax-search") {
      return await searchMiniMax(q);
    }
    if (strategy === "fallback-search") {
      return await searchFallback(q);
    }
    return "当前策略不支持客户端搜索执行。";
  } catch (err: any) {
    console.warn("[web-search] search failed:", err?.message);
    return `搜索失败：${err?.message || "未知错误"}。请基于已有知识继续生成。`;
  }
}
