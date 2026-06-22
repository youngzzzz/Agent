/**
 * 统一 LLM 调用层 —— 用原生 fetch，支持任何 OpenAI 兼容协议的供应商。
 *
 * 环境变量：
 *   LLM_API_KEY      必填
 *   LLM_BASE_URL     必填，到 /v1 为止（不含末尾斜杠）
 *   LLM_MODEL        必填
 *   LLM_PATH         可选，默认 /chat/completions；MiniMax Anthropic 用 /v1/messages
 *
 * Provider 速查：
 *   ┌───────────┬────────────────────────────────────────────┬──────────────────────────┬──────────────────────────────┐
 *   │ Provider  │ LLM_BASE_URL                               │ LLM_PATH                 │ LLM_MODEL                    │
 *   ├───────────┼────────────────────────────────────────────┼──────────────────────────┼──────────────────────────────┤
 *   │ MiniMax   │ https://api.minimaxi.com/v1               │ /chat/completions        │ minimax-M2.7                │
 *   │ MiniMax   │ https://api.minimaxi.com/anthropic        │ /v1/messages (Anthropic) │ minimax-M2.7                │
 *   │ DeepSeek  │ https://api.deepseek.com/v1               │ /chat/completions        │ deepseek-v4-flash           │
 *   │ 智谱 GLM  │ https://open.bigmodel.cn/api/paas/v4      │ /chat/completions        │ glm-4-flash                 │
 *   │ 通义千问  │ https://dashscope.aliyuncs.com/compatible-mode/v1 │ /chat/completions │ qwen-plus                   │
 *   │ Moonshot  │ https://api.moonshot.cn/v1                │ /chat/completions        │ moonshot-v1-32k             │
 *   │ OpenAI    │ https://api.openai.com/v1                │ /chat/completions        │ gpt-4o-mini                 │
 *   └───────────┴────────────────────────────────────────────┴──────────────────────────┴──────────────────────────────┘
 */

const LLM_FETCH_TIMEOUT_MS = 15 * 60 * 1000;

interface LLMConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  path: string;
}

function getConfig(): LLMConfig {
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

/** DeepSeek 思考模式配置（从环境变量读取） */
function getDeepSeekThinkingConfig(): { enabled: boolean; effort: "low" | "medium" | "high" | "max" } {
  const enabled = process.env.LLM_THINKING_ENABLED === "true";
  const effort = (process.env.LLM_REASONING_EFFORT as any) || "high";
  if (!["low", "medium", "high", "max"].includes(effort)) {
    return { enabled, effort: "high" };
  }
  return { enabled, effort };
}

export interface ChatMessageParam {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
  reasoning_effort?: "low" | "medium" | "high" | "max";
  thinking?: boolean;
}

/** 一次性返回完整文本。 */
export async function chatCompletion(
  messages: ChatMessageParam[],
  opts: ChatOptions = {},
): Promise<string> {
  const cfg = getConfig();
  const thinkingCfg = getDeepSeekThinkingConfig();
  const isMiniMaxAnthropic = cfg.path === "/v1/messages" || (cfg.model.toLowerCase().includes("minimax") && cfg.path.includes("anthropic"));
  const isDeepSeek = cfg.model.toLowerCase().includes("deepseek") && cfg.path === "/chat/completions";
  const isDeepSeekThinking = isDeepSeek && thinkingCfg.enabled;

  let body: any;

  if (isMiniMaxAnthropic) {
    // Anthropic 格式：content 要是数组 [{"type": "text", "text": "..."}]
    body = {
      model: cfg.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: [{ type: "text", text: m.content }],
      })),
      max_tokens: opts.max_tokens ?? 32000,
    };
  } else {
    const isMiniMax = cfg.path === "/text/chatcompletion_v2" || cfg.model.toLowerCase().includes("minimax");
    const adaptedMessages = isMiniMax
      ? messages.map((m) => ({ role: m.role, text: m.content }))
      : messages;
    body = {
      model: cfg.model,
      messages: adaptedMessages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.max_tokens ?? 32000,
      ...(opts.response_format ? { response_format: opts.response_format } : {}),
    };
    // DeepSeek 深度思考模式：extra_body 传 thinking 开关 + reasoning_effort
    if (isDeepSeekThinking) {
      body.reasoning_effort = thinkingCfg.effort;
      body.extra_body = { thinking: { type: "enabled" } };
    }
  }

  const res = await fetch(cfg.baseURL + cfg.path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(LLM_FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(`LLM HTTP ${res.status}: ${text.slice(0, 400)}`), {
      status: res.status,
    });
  }

  const data: any = await res.json();
  if (data?.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`LLM 业务错误：${data.base_resp.status_msg}`);
  }

  let content = "";
  if (isMiniMaxAnthropic) {
    // Anthropic 响应：content 是数组 [{"type": "thinking", ...}, {"type": "text", "text": "..."}]
    // 找到 type === "text" 的那个
    const textItem = data?.content?.find((c: any) => c.type === "text");
    content = textItem?.text ?? "";
  } else {
    // OpenAI/MiniMax/DeepSeek 响应
    // DeepSeek 深度思考模式下 reasoning_content 会一起返回，只取 content（思考过程对用户不可见）
    content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.message?.text ?? "";
  }
  // 去除 markdown code fence
  content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return content;
}

/** 流式输出，每个 delta 触发一次 onDelta。返回完整文本。 */
export async function chatCompletionStream(
  messages: ChatMessageParam[],
  opts: ChatOptions,
  onDelta: (chunk: string) => void,
): Promise<string> {
  const cfg = getConfig();
  const thinkingCfg = getDeepSeekThinkingConfig();
  const isMiniMaxAnthropic = cfg.path === "/v1/messages" || (cfg.model.toLowerCase().includes("minimax") && cfg.path.includes("anthropic"));
  const isDeepSeek = cfg.model.toLowerCase().includes("deepseek") && cfg.path === "/chat/completions";
  const isDeepSeekThinking = isDeepSeek && thinkingCfg.enabled;

  let body: any;

  if (isMiniMaxAnthropic) {
    body = {
      model: cfg.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: [{ type: "text", text: m.content }],
      })),
      max_tokens: opts.max_tokens ?? 32000,
      stream: true,
    };
  } else {
    const isMiniMax = cfg.path === "/text/chatcompletion_v2" || cfg.model.toLowerCase().includes("minimax");
    const adaptedMessages = isMiniMax
      ? messages.map((m) => ({ role: m.role, text: m.content }))
      : messages;
    body = {
      model: cfg.model,
      messages: adaptedMessages,
      stream: true,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.max_tokens ?? 32000,
    };
    // DeepSeek 深度思考模式
    if (isDeepSeekThinking) {
      body.reasoning_effort = opts.reasoning_effort ?? "high";
      body.extra_body = { thinking: { type: "enabled" } };
    }
  }

  const res = await fetch(cfg.baseURL + cfg.path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(LLM_FETCH_TIMEOUT_MS),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(`LLM HTTP ${res.status}: ${text.slice(0, 400)}`), {
      status: res.status,
    });
  }

  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE：每条事件以 "data: ...\n\n" 分隔
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return full;
      try {
        const json: any = JSON.parse(payload);
        let delta = "";
        if (isMiniMaxAnthropic) {
          // Anthropic SSE: content_block_delta / 兼容非流式 content 数组
          if (json?.type === "content_block_delta") {
            delta = json?.delta?.text ?? "";
          } else {
            const textItem = json?.content?.find((c: any) => c.type === "text");
            delta = textItem?.text ?? "";
          }
        } else {
          // OpenAI/MiniMax/DeepSeek 响应（DeepSeek 思考模式的 reasoning_content 被忽略）
          delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.delta?.text ?? "";
        }
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {
        // 忽略解析失败的心跳/空行
      }
    }
  }
  // 去除 markdown code fence
  return full.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}
