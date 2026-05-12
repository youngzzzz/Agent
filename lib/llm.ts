import OpenAI from "openai";

/**
 * 统一 LLM 适配层 —— 任何 OpenAI 兼容 API 都能直接接入。
 *
 * 通过环境变量配置（仅服务端可读）：
 *   LLM_API_KEY      必填，对应供应商的 API Key
 *   LLM_BASE_URL     必填，OpenAI 兼容的 base URL
 *   LLM_MODEL        必填，模型名
 *
 * 常见供应商参考（自行替换）：
 *   ┌─────────────┬───────────────────────────────────────────┬─────────────────────────────┐
 *   │ Provider    │ LLM_BASE_URL                              │ LLM_MODEL 示例              │
 *   ├─────────────┼───────────────────────────────────────────┼─────────────────────────────┤
 *   │ MiniMax     │ https://api.minimaxi.com/v1               │ MiniMax-Text-01 / abab6.5s-chat │
 *   │ DeepSeek    │ https://api.deepseek.com/v1               │ deepseek-chat / deepseek-reasoner │
 *   │ 智谱 GLM    │ https://open.bigmodel.cn/api/paas/v4      │ glm-4-flash / glm-4-plus    │
 *   │ 通义千问    │ https://dashscope.aliyuncs.com/compatible-mode/v1 │ qwen-plus / qwen-turbo │
 *   │ Moonshot    │ https://api.moonshot.cn/v1                │ moonshot-v1-32k             │
 *   │ OpenRouter  │ https://openrouter.ai/api/v1              │ anthropic/claude-sonnet-4   │
 *   │ OpenAI      │ https://api.openai.com/v1                 │ gpt-4o-mini                 │
 *   └─────────────┴───────────────────────────────────────────┴─────────────────────────────┘
 */
export function getLLMClient() {
  const apiKey = process.env.LLM_API_KEY;
  const baseURL = process.env.LLM_BASE_URL;
  if (!apiKey || !baseURL) {
    throw new Error(
      "LLM_API_KEY 和 LLM_BASE_URL 必须配置。本地写到 .env.local，Vercel 在 Project → Settings → Environment Variables 添加。",
    );
  }
  return new OpenAI({ apiKey, baseURL });
}

export function getModelName() {
  return process.env.LLM_MODEL || "deepseek-chat";
}
