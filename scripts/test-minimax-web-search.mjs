/**
 * MiniMax 互联网检索测试
 *
 * 用法:
 *   node scripts/test-minimax-web-search.mjs           # 完整测试（搜索 API + LLM 工具调用）
 *   node scripts/test-minimax-web-search.mjs --api-only # 仅测 MiniMax Search API
 *
 * 读取 .env.local，需配置 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL
 * 建议开启 LLM_WEB_SEARCH_ENABLED=true；MiniMax 搜索 Key 可用 MINIMAX_SEARCH_API_KEY
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const env = {};
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const apiOnly = process.argv.includes("--api-only");
const TEST_QUERY = "2026年6月 MiniMax 大模型 最新动态";

const WEB_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "web_search",
    description: "检索互联网获取最新行业动态、竞品信息、政策法规、技术趋势等。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词" },
      },
      required: ["query"],
    },
  },
};

function maskKey(key) {
  if (!key) return "(missing)";
  return `${key.slice(0, 4)}...${key.slice(-4)} (len=${key.length})`;
}

function isMiniMaxModel(model) {
  const m = model.toLowerCase();
  return m.includes("minimax") || m.includes("m2") || m.includes("m3");
}

function getMiniMaxSearchConfig() {
  const apiKey = env.MINIMAX_SEARCH_API_KEY || env.LLM_API_KEY || "";
  let baseURL =
    env.MINIMAX_SEARCH_BASE_URL || env.LLM_BASE_URL || "https://api.minimaxi.com";
  baseURL = baseURL.replace(/\/+$/, "").replace(/\/anthropic$/, "").replace(/\/v1$/, "");
  return { apiKey, baseURL };
}

function getWebSearchMaxResults() {
  const n = parseInt(env.LLM_WEB_SEARCH_MAX_RESULTS || "5", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 5;
}

function normalizeHits(data, maxResults) {
  const raw =
    data?.results ??
    data?.data?.results ??
    data?.organic ??
    data?.search_results ??
    data?.items ??
    [];
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, maxResults).map((item) => ({
    title: String(item.title ?? item.name ?? item.headline ?? "无标题"),
    url: String(item.url ?? item.link ?? item.uri ?? ""),
    snippet: String(item.snippet ?? item.description ?? item.content ?? item.summary ?? ""),
  }));
}

function isUsableSearchText(text) {
  return (
    !!text &&
    !text.startsWith("搜索失败") &&
    !text.startsWith("当前策略") &&
    text !== "搜索词为空。" &&
    text !== "未找到相关结果。"
  );
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isMiniMaxAnthropic(cfg) {
  return (
    cfg.path === "/v1/messages" ||
    cfg.path.includes("anthropic") ||
    (cfg.model.toLowerCase().includes("minimax") && cfg.baseURL.includes("anthropic"))
  );
}

async function searchMiniMax(query) {
  const { apiKey, baseURL } = getMiniMaxSearchConfig();
  if (!apiKey) throw new Error("缺少 MINIMAX_SEARCH_API_KEY 或 LLM_API_KEY");

  const maxResults = getWebSearchMaxResults();
  const url = `${baseURL}/v1/coding_plan/search`;

  async function doFetch(body) {
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }, 60_000);
    return res;
  }

  let res = await doFetch({ query, count: maxResults });
  if (!res.ok && (res.status === 400 || res.status === 422)) {
    res = await doFetch({ q: query, count: maxResults });
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`MiniMax Search HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const hits = normalizeHits(data, maxResults);
  return { hits, raw: data };
}

function getLlmConfig() {
  const apiKey = env.LLM_API_KEY;
  const baseURL = (env.LLM_BASE_URL || "").replace(/\/+$/, "");
  const model = env.LLM_MODEL;
  const path = env.LLM_PATH || "/chat/completions";
  if (!apiKey || !baseURL || !model) {
    throw new Error("缺少 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL");
  }
  return { apiKey, baseURL, model, path, url: baseURL + path };
}

async function llmWithWebSearchTool() {
  const cfg = getLlmConfig();
  const useAnthropic = isMiniMaxAnthropic(cfg);
  const isMiniMax = cfg.path === "/text/chatcompletion_v2" || isMiniMaxModel(cfg.model);

  const systemPrompt =
    "你具备 web_search 工具。用户要求联网时，必须先调用 web_search，再基于结果回答。回答简洁，100字以内。";
  const userPrompt = `请调用 web_search 搜索「${TEST_QUERY}」，然后一句话总结你找到的最新信息。`;

  if (useAnthropic) {
    const body = {
      model: cfg.model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        { role: "user", content: [{ type: "text", text: userPrompt }] },
      ],
      tools: [
        {
          name: "web_search",
          description: "检索互联网获取最新行业动态、竞品信息、政策法规、技术趋势等。",
          input_schema: {
            type: "object",
            properties: { query: { type: "string", description: "搜索关键词" } },
            required: ["query"],
          },
        },
      ],
    };

    const start = Date.now();
    const res = await fetchWithTimeout(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
    }, 120_000);

    const elapsed = Date.now() - start;
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`LLM HTTP ${res.status} (${elapsed}ms): ${text.slice(0, 400)}`);
    }

    const data = JSON.parse(text);
    const contentBlocks = data.content ?? [];
    const toolUses = contentBlocks.filter((b) => b.type === "tool_use" && b.name === "web_search");

    let searchExecuted = 0;
    let searchUsable = 0;
    const searchSummaries = [];

    for (const tu of toolUses) {
      const q = tu.input?.query || TEST_QUERY;
      try {
        const { hits } = await searchMiniMax(q);
        searchExecuted++;
        if (hits.length > 0) searchUsable++;
        searchSummaries.push({ query: q, hitCount: hits.length, firstTitle: hits[0]?.title ?? "" });
      } catch (err) {
        searchSummaries.push({ query: q, error: err.message });
      }
    }

    const reply = contentBlocks
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .slice(0, 200);

    return {
      elapsed,
      protocol: "anthropic",
      stopReason: data.stop_reason,
      toolCallCount: toolUses.length,
      searchExecuted,
      searchUsable,
      searchSummaries,
      reply,
      rawMessage: data,
    };
  }

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const openAIMessages = messages.map((m) =>
    isMiniMax && m.role !== "system" ? { role: m.role, text: m.content } : m,
  );

  const body = {
    model: cfg.model,
    messages: openAIMessages,
    tools: [WEB_SEARCH_TOOL],
    tool_choice: "auto",
    temperature: 0.3,
    max_tokens: 2000,
  };

  const start = Date.now();
  const res = await fetchWithTimeout(cfg.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  }, 120_000);

  const elapsed = Date.now() - start;
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`LLM HTTP ${res.status} (${elapsed}ms): ${text.slice(0, 400)}`);
  }

  const data = JSON.parse(text);
  const msg = data?.choices?.[0]?.message;
  const toolCalls = msg?.tool_calls ?? [];
  const webSearchCalls = toolCalls.filter((tc) => tc.function?.name === "web_search");

  let searchExecuted = 0;
  let searchUsable = 0;
  const searchSummaries = [];

  for (const tc of webSearchCalls) {
    let args = {};
    try {
      args = JSON.parse(tc.function.arguments || "{}");
    } catch {
      /* ignore */
    }
    const q = args.query || TEST_QUERY;
    try {
      const { hits } = await searchMiniMax(q);
      searchExecuted++;
      if (hits.length > 0) searchUsable++;
      searchSummaries.push({ query: q, hitCount: hits.length, firstTitle: hits[0]?.title ?? "" });
    } catch (err) {
      searchSummaries.push({ query: q, error: err.message });
    }
  }

  const reply = msg?.content ?? msg?.text ?? "";
  return {
    elapsed,
    protocol: "openai",
    toolCallCount: webSearchCalls.length,
    searchExecuted,
    searchUsable,
    searchSummaries,
    reply: typeof reply === "string" ? reply.slice(0, 200) : JSON.stringify(reply).slice(0, 200),
    rawMessage: msg,
  };
}

function pass(msg) {
  console.log(`  ✅ ${msg}`);
}
function fail(msg) {
  console.log(`  ❌ ${msg}`);
}
function info(msg) {
  console.log(`  ${msg}`);
}

console.log("=== MiniMax 互联网检索测试 ===\n");

const searchCfg = getMiniMaxSearchConfig();
const llmCfg = getLlmConfig();
const webSearchEnabled = env.LLM_WEB_SEARCH_ENABLED === "true";

console.log("[配置]");
info(`LLM_WEB_SEARCH_ENABLED: ${webSearchEnabled}`);
info(`LLM: ${llmCfg.model} @ ${llmCfg.url}`);
info(`MiniMax Search: ${searchCfg.baseURL}/v1/coding_plan/search`);
info(`Search Key: ${maskKey(searchCfg.apiKey)}`);
if (!isMiniMaxModel(llmCfg.model)) {
  console.warn("\n⚠️  当前 LLM_MODEL 不像 MiniMax，仍会继续测试搜索 API。\n");
}

const results = { api: false, agent: false };

// --- 测试 1: Search API 直连 ---
console.log("\n[测试 1] MiniMax Search API 直连");
info(`查询: "${TEST_QUERY}"`);
try {
  const start = Date.now();
  const { hits } = await searchMiniMax(TEST_QUERY);
  const elapsed = Date.now() - start;
  if (hits.length > 0) {
    pass(`返回 ${hits.length} 条结果 (${elapsed}ms)`);
    info(`首条: ${hits[0].title}`);
    if (hits[0].url) info(`链接: ${hits[0].url}`);
    results.api = true;
  } else {
    fail(`HTTP 成功但无结果 (${elapsed}ms)`);
  }
} catch (err) {
  fail(err.message);
}

// --- 测试 2: LLM 是否调用 web_search ---
if (!apiOnly) {
  console.log("\n[测试 2] LLM + web_search 工具调用");
  try {
    const r = await llmWithWebSearchTool();
    info(`协议: ${r.protocol}`);
    info(`LLM 响应耗时: ${r.elapsed}ms`);
    if (r.stopReason) info(`stop_reason: ${r.stopReason}`);

    if (r.toolCallCount > 0) {
      pass(`模型发起了 ${r.toolCallCount} 次 web_search 工具调用`);
    } else {
      fail("模型未调用 web_search（可能未识别工具或模型不支持 function calling）");
      if (r.rawMessage) {
        info(`模型直接回复: ${r.reply || "(空)"}`);
      }
    }

    if (r.searchExecuted > 0) {
      pass(`已执行 ${r.searchExecuted} 次 MiniMax 搜索`);
      for (const s of r.searchSummaries) {
        if (s.error) info(`  查询「${s.query}」失败: ${s.error}`);
        else info(`  查询「${s.query}」→ ${s.hitCount} 条，首条: ${s.firstTitle}`);
      }
    }

    if (r.searchUsable > 0) {
      pass("搜索返回了有效结果");
      results.agent = true;
    } else if (r.toolCallCount > 0) {
      fail("工具已调用但搜索未返回有效结果");
    }

    if (r.reply && r.toolCallCount === 0 && isUsableSearchText(r.reply)) {
      info(`模型可能内置了联网能力，直接回复: ${r.reply}`);
    }
  } catch (err) {
    fail(err.message);
  }
} else {
  info("(已跳过，使用了 --api-only)");
}

// --- 总结 ---
console.log("\n[总结]");
const total = apiOnly ? 1 : 2;
const passed = (results.api ? 1 : 0) + (apiOnly ? 0 : results.agent ? 1 : 0);
console.log(`${passed}/${total} 项通过`);

if (!webSearchEnabled) {
  console.log("\n提示: .env.local 中 LLM_WEB_SEARCH_ENABLED 未设为 true，应用内生成/对话不会启用联网检索。");
}

process.exit(passed === total ? 0 : 1);
