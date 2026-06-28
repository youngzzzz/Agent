import { isAnthropicProtocol, isDeepSeekModel, isMiniMaxModel, LLMConfig } from "@/lib/llm-config";
import { isWebSearchEnabled } from "@/lib/web-search/config";

/** 联网检索后端策略 */
export type WebSearchStrategy =
  | "deepseek-anthropic-native"
  | "minimax-search"
  | "fallback-search"
  | "disabled";

const MINIMAX_SEARCH_MODELS = ["m3", "minimax-m3", "minimax-m2"];
const DEEPSEEK_SEARCH_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-v4"];

function modelMatches(list: string[], model: string): boolean {
  const m = model.toLowerCase();
  return list.some((id) => m.includes(id));
}

export function resolveWebSearchStrategy(cfg: LLMConfig): WebSearchStrategy {
  if (!isWebSearchEnabled()) return "disabled";

  const model = cfg.model.toLowerCase();

  if (
    isDeepSeekModel(cfg) &&
    modelMatches(DEEPSEEK_SEARCH_MODELS, model) &&
    isAnthropicProtocol(cfg)
  ) {
    return "deepseek-anthropic-native";
  }

  if (isMiniMaxModel(cfg) && modelMatches(MINIMAX_SEARCH_MODELS, model)) {
    return "minimax-search";
  }

  if (isDeepSeekModel(cfg) && modelMatches(DEEPSEEK_SEARCH_MODELS, model)) {
    return "fallback-search";
  }

  if (isMiniMaxModel(cfg)) {
    return "minimax-search";
  }

  return "fallback-search";
}

export function strategyLabel(strategy: WebSearchStrategy): string {
  switch (strategy) {
    case "deepseek-anthropic-native":
      return "DeepSeek 原生 web_search";
    case "minimax-search":
      return "MiniMax Token Plan Search";
    case "fallback-search":
      return "第三方搜索兜底";
    default:
      return "未启用";
  }
}
