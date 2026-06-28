import {
  getDeepSeekThinkingConfig,
  getLLMConfig,
  isAnthropicProtocol,
  isDeepSeekModel,
  isMiniMaxModel,
  isRateLimitError,
  LLM_FETCH_TIMEOUT_MS,
} from "@/lib/llm-config";
import { chatCompletionStream } from "@/lib/llm";
import {
  executeWebSearch,
  getWebSearchMaxRounds,
  isWebSearchEnabled,
  resolveWebSearchStrategy,
  strategyLabel,
  WebSearchStrategy,
} from "@/lib/web-search";

export interface AgentMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export const WEB_SEARCH_SYSTEM_APPEND = `
你具备 web_search 互联网检索能力。生成方案前，请主动搜索 1-2 次以获取该行业/场景的最新趋势、竞品案例与政策背景，再基于检索结果输出完整 JSON 方案。
搜索与生成完成后，直接输出完整 JSON 对象：第一个字符必须是 {，最后一个字符必须是 }。
禁止输出任何前言、后语、Markdown、代码块围栏或搜索过程说明。`;

/** 工作台「和 AI 讨论」场景的联网检索说明 */
export const WEB_SEARCH_CHAT_SYSTEM_APPEND = `
你具备 web_search 互联网检索能力。当用户问题涉及最新行业动态、竞品案例、政策法规、技术趋势或需要核实事实时，请先搜索再回答。
回答时仍须遵循 Markdown 格式要求，可自然引用检索到的信息，不要只输出搜索摘要。`;

export interface AgentResult {
  text: string;
  webSearchUsed: boolean;
  strategy: WebSearchStrategy;
  searchRounds: number;
}

const WEB_SEARCH_TOOL_OPENAI = {
  type: "function" as const,
  function: {
    name: "web_search",
    description:
      "检索互联网获取最新行业动态、竞品信息、政策法规、技术趋势等。在生成方案前按需调用。",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索关键词，建议包含行业、场景、年份",
        },
      },
      required: ["query"],
    },
  },
};

const WEB_SEARCH_TOOL_ANTHROPIC_CLIENT = {
  name: "web_search",
  description:
    "检索互联网获取最新行业动态、竞品信息、政策法规、技术趋势等。在生成方案前按需调用。",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "搜索关键词" },
    },
    required: ["query"],
  },
};

function stripFence(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function splitSystem(messages: AgentMessage[]): {
  system: string;
  rest: AgentMessage[];
} {
  const systemParts: string[] = [];
  const rest: AgentMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") systemParts.push(m.content);
    else rest.push(m);
  }
  return { system: systemParts.join("\n\n"), rest };
}

async function llmFetch(cfg: ReturnType<typeof getLLMConfig>, body: Record<string, unknown>) {
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
    throw Object.assign(new Error(`LLM 业务错误：${data.base_resp.status_msg}`), {
      bizCode: data.base_resp.status_code,
    });
  }
  return data;
}

function toAnthropicMessages(messages: AgentMessage[]): any[] {
  return messages.map((m) => ({
    role: m.role,
    content: [{ type: "text", text: m.content }],
  }));
}

function extractAnthropicText(contentBlocks: any[]): string {
  return (contentBlocks ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

function countServerWebSearch(contentBlocks: any[]): number {
  return (contentBlocks ?? []).filter(
    (b) =>
      b.type === "server_tool_use" ||
      b.type === "web_search_tool_result" ||
      (b.type === "tool_use" && b.name === "web_search"),
  ).length;
}

async function runOpenAIClientToolAgent(
  cfg: ReturnType<typeof getLLMConfig>,
  messages: AgentMessage[],
  opts: { max_tokens?: number; temperature?: number },
  strategy: WebSearchStrategy,
  maxRounds: number,
): Promise<{ text: string; searchRounds: number }> {
  const thinkingCfg = getDeepSeekThinkingConfig();
  const isDeepSeek =
    cfg.model.toLowerCase().includes("deepseek") && cfg.path === "/chat/completions";
  const isMiniMax =
    cfg.path === "/text/chatcompletion_v2" || isMiniMaxModel(cfg);

  const openAIMessages: any[] = messages.map((m) =>
    isMiniMax && m.role !== "system"
      ? { role: m.role, text: m.content }
      : { role: m.role, content: m.content },
  );

  let searchRounds = 0;
  const maxIterations = maxRounds + 2;

  for (let i = 0; i < maxIterations; i++) {
    const body: any = {
      model: cfg.model,
      messages: openAIMessages,
      tools: [WEB_SEARCH_TOOL_OPENAI],
      tool_choice: "auto",
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.max_tokens ?? 8000,
    };

    if (isDeepSeek && thinkingCfg.enabled) {
      body.reasoning_effort = thinkingCfg.effort;
      body.extra_body = { thinking: { type: "enabled" } };
    }

    const data = await llmFetch(cfg, body);
    const msg = data?.choices?.[0]?.message;
    const toolCalls = msg?.tool_calls ?? [];

    if (toolCalls.length > 0) {
      searchRounds += toolCalls.filter(
        (tc: any) => tc.function?.name === "web_search",
      ).length;
      openAIMessages.push(msg);

      for (const tc of toolCalls) {
        if (tc.function?.name !== "web_search") continue;
        let args: { query?: string } = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          /* ignore */
        }
        const result = await executeWebSearch(args.query || "", strategy);
        openAIMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }
      continue;
    }

    const content = msg?.content ?? msg?.text ?? "";
    if (content) {
      return { text: stripFence(content), searchRounds };
    }
  }

  throw new Error("联网检索轮次已达上限，未能生成最终方案");
}

async function runAnthropicClientToolAgent(
  cfg: ReturnType<typeof getLLMConfig>,
  messages: AgentMessage[],
  opts: { max_tokens?: number },
  strategy: WebSearchStrategy,
  maxRounds: number,
): Promise<{ text: string; searchRounds: number }> {
  const { system, rest } = splitSystem(messages);
  const anthropicMessages = toAnthropicMessages(rest);
  let searchRounds = 0;
  const maxIterations = maxRounds + 2;

  for (let i = 0; i < maxIterations; i++) {
    const data = await llmFetch(cfg, {
      model: cfg.model,
      max_tokens: opts.max_tokens ?? 8000,
      system,
      messages: anthropicMessages,
      tools: [WEB_SEARCH_TOOL_ANTHROPIC_CLIENT],
    });

    const contentBlocks = data.content ?? [];
    const stopReason = data.stop_reason;
    const toolUses = contentBlocks.filter((b: any) => b.type === "tool_use");
    const text = extractAnthropicText(contentBlocks);

    if (toolUses.length > 0 && stopReason === "tool_use") {
      searchRounds += toolUses.filter((tu: any) => tu.name === "web_search").length;
      anthropicMessages.push({ role: "assistant", content: contentBlocks });

      const toolResults = await Promise.all(
        toolUses.map(async (tu: any) => {
          const query = tu.input?.query ?? "";
          const result =
            tu.name === "web_search"
              ? await executeWebSearch(query, strategy)
              : `未知工具：${tu.name}`;
          return {
            type: "tool_result",
            tool_use_id: tu.id,
            content: result,
          };
        }),
      );

      anthropicMessages.push({ role: "user", content: toolResults });
      continue;
    }

    if (text) {
      return { text: stripFence(text), searchRounds };
    }

    if (stopReason === "end_turn") {
      return { text: stripFence(text), searchRounds };
    }
  }

  throw new Error("联网检索轮次已达上限，未能生成最终方案");
}

async function runAnthropicNativeWebSearchAgent(
  cfg: ReturnType<typeof getLLMConfig>,
  messages: AgentMessage[],
  opts: { max_tokens?: number },
  maxRounds: number,
): Promise<{ text: string; searchRounds: number }> {
  const { system, rest } = splitSystem(messages);
  const anthropicMessages = toAnthropicMessages(rest);
  const thinkingCfg = getDeepSeekThinkingConfig();
  let searchRounds = 0;
  const maxIterations = maxRounds + 3;

  for (let i = 0; i < maxIterations; i++) {
    const body: Record<string, any> = {
      model: cfg.model,
      max_tokens: opts.max_tokens ?? 8000,
      system,
      messages: anthropicMessages,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: maxRounds,
        },
      ],
    };
    // DeepSeek V4 原生联网 + 思考可共存：补上 thinking / output_config
    if (isDeepSeekModel(cfg) && thinkingCfg.enabled) {
      body.thinking = { type: "enabled" };
      body.output_config = { effort: thinkingCfg.effort === "max" ? "max" : "high" };
    }
    const data = await llmFetch(cfg, body);

    const contentBlocks = data.content ?? [];
    const stopReason = data.stop_reason;
    const text = extractAnthropicText(contentBlocks);
    searchRounds += countServerWebSearch(contentBlocks);

    if (text && (stopReason === "end_turn" || stopReason === "stop_sequence")) {
      return { text: stripFence(text), searchRounds: Math.max(searchRounds, 1) };
    }

    if (stopReason === "pause_turn") {
      anthropicMessages.push({ role: "assistant", content: contentBlocks });
      anthropicMessages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: "请基于已检索到的信息，继续完成四层 AI 转型方案，输出完整 JSON。",
          },
        ],
      });
      continue;
    }

    if (text) {
      return { text: stripFence(text), searchRounds: Math.max(searchRounds, 1) };
    }

    anthropicMessages.push({ role: "assistant", content: contentBlocks });
  }

  throw new Error("DeepSeek 原生联网检索未完成");
}

/**
 * 带互联网检索的 LLM 调用：按模型自动选择检索后端，多轮 Tool Loop 后返回最终文本。
 */
export async function chatCompletionWithWebSearch(
  messages: AgentMessage[],
  opts: { max_tokens?: number; temperature?: number } = {},
  cfgOverride?: ReturnType<typeof getLLMConfig>,
): Promise<AgentResult> {
  const cfg = cfgOverride ?? getLLMConfig();
  const strategy = resolveWebSearchStrategy(cfg);

  if (!isWebSearchEnabled() || strategy === "disabled") {
    const text = await chatCompletionStream(messages, opts, () => {}, cfg);
    return { text, webSearchUsed: false, strategy: "disabled", searchRounds: 0 };
  }

  console.info(`[web-search] enabled strategy=${strategyLabel(strategy)} model=${cfg.model}`);

  const maxRounds = getWebSearchMaxRounds();

  try {
    if (strategy === "deepseek-anthropic-native") {
      const result = await runAnthropicNativeWebSearchAgent(cfg, messages, opts, maxRounds);
      return {
        text: result.text,
        webSearchUsed: result.searchRounds > 0,
        strategy,
        searchRounds: result.searchRounds,
      };
    }

    if (isAnthropicProtocol(cfg)) {
      const result = await runAnthropicClientToolAgent(
        cfg,
        messages,
        opts,
        strategy,
        maxRounds,
      );
      return {
        text: result.text,
        webSearchUsed: result.searchRounds > 0,
        strategy,
        searchRounds: result.searchRounds,
      };
    }

    const result = await runOpenAIClientToolAgent(
      cfg,
      messages,
      opts,
      strategy,
      maxRounds,
    );
    return {
      text: result.text,
      webSearchUsed: result.searchRounds > 0,
      strategy,
      searchRounds: result.searchRounds,
    };
  } catch (err: any) {
    // 限流类错误需向上抛出，让外层 runLlmWithFallback 切换到备用 Provider；
    // 其余错误（如检索失败）才降级为不联网的纯 LLM 调用。
    if (isRateLimitError(err)) throw err;
    console.warn(
      `[web-search] agent failed (${strategyLabel(strategy)}), fallback to plain LLM:`,
      err?.message,
    );
    const text = await chatCompletionStream(messages, opts, () => {}, cfg);
    return { text, webSearchUsed: false, strategy, searchRounds: 0 };
  }
}
