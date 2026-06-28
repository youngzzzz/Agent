/**
 * 主 → 备 Provider 自动切换。
 *
 * 优先走主 Provider（如 MiniMax Token Plan）；当主 Provider 触发限流 / 并发超限 /
 * 额度耗尽（isRateLimitError 命中）且配置了备用 Provider（如 DeepSeek）时，
 * 自动用备用 Provider 重试一次。
 *
 * 用法：把对 LLM 的调用包进回调里，回调接收要使用的 cfg：
 *   const text = await runLlmWithFallback((cfg) =>
 *     chatCompletionStream(messages, opts, onDelta, cfg),
 *   );
 *
 * 安全性：限流类错误几乎都发生在请求建立阶段（HTTP 429 在流式响应体产生之前），
 * 因此切换前不会有半截内容已经吐给客户端，重试是干净的。
 */

import {
  getLLMConfig,
  hasFallbackConfig,
  isRateLimitError,
  type LLMConfig,
  type LLMRole,
} from "@/lib/llm-config";

export async function runLlmWithFallback<T>(
  fn: (cfg: LLMConfig, role: LLMRole) => Promise<T>,
): Promise<T> {
  const primary = getLLMConfig("primary");

  try {
    return await fn(primary, "primary");
  } catch (err) {
    if (!isRateLimitError(err) || !hasFallbackConfig()) throw err;

    let fallback: LLMConfig;
    try {
      fallback = getLLMConfig("fallback");
    } catch {
      throw err; // 兜底配置不完整，抛出原始限流错误
    }

    // 主备指向同一模型/端点时无意义，直接抛原始错误
    if (fallback.baseURL === primary.baseURL && fallback.model === primary.model) {
      throw err;
    }

    console.warn(
      `[llm-fallback] 主 Provider(${primary.model}) 触发限流，切换到备用(${fallback.model})：` +
        String((err as { message?: string })?.message ?? "").slice(0, 160),
    );
    return await fn(fallback, "fallback");
  }
}
