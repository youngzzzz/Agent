/**
 * 统一 LLM 调用层 —— 用原生 fetch，支持任何 OpenAI 兼容协议的供应商。
 *
 * 环境变量：
 *   LLM_API_KEY      必填
 *   LLM_BASE_URL     必填，到 /v1 为止（不含末尾斜杠）
 *   LLM_MODEL        必填
 *   LLM_PATH         可选，默认 /chat/completions；MiniMax 用 /text/chatcompletion_v2
 *
 * Provider 速查：
 *   ┌───────────┬────────────────────────────────────────────┬──────────────────────────┬──────────────────────────────┐
 *   │ Provider  │ LLM_BASE_URL                               │ LLM_PATH                 │ LLM_MODEL                    │
 *   ├───────────┼────────────────────────────────────────────┼──────────────────────────┼──────────────────────────────┤
 *   │ MiniMax   │ https://api.minimax.chat/v1                │ /text/chatcompletion_v2  │ minimax-M2.7 (codingplan)  │
 *   │ DeepSeek  │ https://api.deepseek.com/v1                │ /chat/completions (默认) │ deepseek-v4                  │
 *   │ 智谱 GLM  │ https://open.bigmodel.cn/api/paas/v4       │ /chat/completions (默认) │ glm-4.5-air                  │
 *   │ 通义千问  │ https://dashscope.aliyuncs.com/compatible-mode/v1 │ /chat/completions │ qwen-plus                    │
 *   │ Moonshot  │ https://api.moonshot.cn/v1                 │ /chat/completions (默认) │ moonshot-v1-32k              │
 *   │ OpenAI    │ https://api.openai.com/v1                  │ /chat/completions (默认) │ gpt-4o-mini                  │
 *   └───────────┴────────────────────────────────────────────┴──────────────────────────┴──────────────────────────────┘
 */

import { Agent, fetch as undiciFetch } from "undici";

// 调大 headers/body 超时到 15 分钟，兼容 reasoning 模型长时间不返回首字节的情况
const llmDispatcher = new Agent({
  headersTimeout: 15 * 60 * 1000,
  bodyTimeout: 15 * 60 * 1000,
  connectTimeout: 60 * 1000,
});

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

export interface ChatMessageParam {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
}

/** 一次性返回完整文本。 */
export async function chatCompletion(
  messages: ChatMessageParam[],
  opts: ChatOptions = {},
): Promise<string> {
  const cfg = getConfig();
  const isMiniMax = cfg.path === "/text/chatcompletion_v2" || cfg.model.toLowerCase().includes("minimax");

  // MiniMax codingplan: 把 content 改成 text
  const adaptedMessages = isMiniMax
    ? messages.map((m) => ({ role: m.role, text: m.content }))
    : messages;

  const res = await undiciFetch(cfg.baseURL + cfg.path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: adaptedMessages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.max_tokens ?? 32000,
      ...(opts.response_format ? { response_format: opts.response_format } : {}),
    }),
    dispatcher: llmDispatcher,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(`LLM HTTP ${res.status}: ${text.slice(0, 400)}`), {
      status: res.status,
    });
  }

  const data: any = await res.json();
  // MiniMax 在 base_resp 里也会塞业务错误码，需要单独检查
  if (data?.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`LLM 业务错误：${data.base_resp.status_msg}`);
  }
  // MiniMax codingplan 返回 text 字段，OpenAI 返回 content
  let content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.message?.text ?? "";
  // 去除 markdown code fence（如 ```json ... ```）
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
  const isMiniMax = cfg.path === "/text/chatcompletion_v2" || cfg.model.toLowerCase().includes("minimax");

  // MiniMax codingplan: 把 content 改成 text
  const adaptedMessages = isMiniMax
    ? messages.map((m) => ({ role: m.role, text: m.content }))
    : messages;

  const res = await undiciFetch(cfg.baseURL + cfg.path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: adaptedMessages,
      stream: true,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.max_tokens ?? 32000,
    }),
    dispatcher: llmDispatcher,
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
        // MiniMax streaming 返回 choices[0].delta.text，OpenAI 返回 choices[0].delta.content
        const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.delta?.text ?? "";
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
