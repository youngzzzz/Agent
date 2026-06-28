export const LLM_FETCH_TIMEOUT_MS = 15 * 60 * 1000;

export interface LLMConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  path: string;
}

export type LLMRole = "primary" | "fallback";

export function getLLMConfig(role: LLMRole = "primary"): LLMConfig {
  if (role === "fallback") {
    const apiKey = process.env.LLM_FALLBACK_API_KEY;
    const baseURL = process.env.LLM_FALLBACK_BASE_URL;
    const model = process.env.LLM_FALLBACK_MODEL;
    if (!apiKey || !baseURL || !model) {
      throw new Error(
        "LLM_FALLBACK_API_KEY / LLM_FALLBACK_BASE_URL / LLM_FALLBACK_MODEL 未配置",
      );
    }
    return {
      apiKey,
      baseURL: baseURL.replace(/\/+$/, ""),
      model,
      path: process.env.LLM_FALLBACK_PATH || "/chat/completions",
    };
  }

  const apiKey = process.env.LLM_API_KEY;
  const baseURL = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  if (!apiKey || !baseURL || !model) {
    throw new Error("LLM_API_KEY / LLM_BASE_URL / LLM_MODEL 必须配置");
  }
  return {
    apiKey,
    baseURL: baseURL.replace(/\/+$/, ""),
    model,
    path: process.env.LLM_PATH || "/chat/completions",
  };
}

/** 是否配置了兜底（备用）Provider。 */
export function hasFallbackConfig(): boolean {
  return !!(
    process.env.LLM_FALLBACK_API_KEY &&
    process.env.LLM_FALLBACK_BASE_URL &&
    process.env.LLM_FALLBACK_MODEL
  );
}

/**
 * 判断错误是否属于「限流 / 并发超限 / 额度耗尽」——这类错误应触发主→备切换。
 * 覆盖：HTTP 429/503/529、MiniMax 业务码(1002 限流 / 1039 token 限流 / 1008 余额不足)、
 * 以及常见限流关键字。
 */
export function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; bizCode?: number; message?: string };

  const status = e.status;
  if (status === 429 || status === 503 || status === 529) return true;

  const biz = e.bizCode;
  if (biz === 1002 || biz === 1039 || biz === 1008) return true;

  const msg = String(e.message ?? "").toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("ratelimit") ||
    msg.includes("too many request") ||
    msg.includes("concurren") ||
    msg.includes("overload") ||
    msg.includes("限流") ||
    msg.includes("过于频繁") ||
    msg.includes("quota") ||
    msg.includes("余额")
  );
}

export function isAnthropicProtocol(cfg: LLMConfig): boolean {
  return (
    cfg.path === "/v1/messages" ||
    cfg.path.includes("anthropic") ||
    (cfg.model.toLowerCase().includes("minimax") && cfg.baseURL.includes("anthropic"))
  );
}

export function isMiniMaxModel(cfg: LLMConfig): boolean {
  const m = cfg.model.toLowerCase();
  return m.includes("minimax") || m.includes("m2") || m.includes("m3");
}

export function isDeepSeekModel(cfg: LLMConfig): boolean {
  return cfg.model.toLowerCase().includes("deepseek");
}

export function getDeepSeekThinkingConfig(): {
  enabled: boolean;
  effort: "low" | "medium" | "high" | "max";
} {
  const enabled = process.env.LLM_THINKING_ENABLED === "true";
  const effort = (process.env.LLM_REASONING_EFFORT as string) || "high";
  if (!["low", "medium", "high", "max"].includes(effort)) {
    return { enabled, effort: "high" };
  }
  return { enabled, effort: effort as "low" | "medium" | "high" | "max" };
}
