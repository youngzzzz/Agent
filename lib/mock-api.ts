import { ChatMessage, GenerateAnalysisInput, ModuleItem, Project } from "./types";
import { buildProject } from "./mock-data";
import { uid } from "./utils";

/**
 * 是否启用真实 LLM。默认 true：调用 /api/generate 与 /api/chat。
 * 设为 false 可强制走本地 mock（演示 / 离线开发）。
 */
const USE_REAL_LLM = process.env.NEXT_PUBLIC_USE_REAL_LLM !== "false";

/* -------------------------- 生成四层拆解 -------------------------- */

export async function mockGenerateAnalysis(input: GenerateAnalysisInput): Promise<Project> {
  if (USE_REAL_LLM) {
    try {
      return await generateAnalysisWithLLM(input);
    } catch (err) {
      console.warn("[generate] fallback to mock:", err);
    }
  }
  await delay(500);
  return buildProject(input);
}

export async function generateAnalysisWithLLM(input: GenerateAnalysisInput): Promise<Project> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as Project;
}

/* -------------------------- 模块对话 -------------------------- */

/**
 * 与某个模块上下文聊天。返回完整的 assistant 消息。
 * 真实模式下走流式接口，但聚合为一条消息返回；如果你想做"边写边显示"，
 * 可以改用 chatStream() 自行处理 stream。
 */
export async function chatWithModuleContext(
  messages: ChatMessage[],
  project: Project,
  moduleItem?: ModuleItem,
): Promise<ChatMessage> {
  if (USE_REAL_LLM) {
    try {
      const text = await chatStreamToString(messages, project, moduleItem);
      return {
        id: uid("msg"),
        role: "assistant",
        content: text,
        timestamp: new Date().toISOString(),
        contextModuleId: moduleItem?.id,
      };
    } catch (err) {
      console.warn("[chat] fallback to mock:", err);
    }
  }
  await delay(400);
  return mockReply(messages, project, moduleItem);
}

/** 流式版本：用回调把每个 delta 推给 UI（聊天 UI 想做打字机效果时用）。 */
export async function chatStream(
  messages: ChatMessage[],
  project: Project,
  moduleItem: ModuleItem | undefined,
  onDelta: (chunk: string) => void,
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, project, module: moduleItem }),
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    full += chunk;
    onDelta(chunk);
  }
  return full;
}

async function chatStreamToString(
  messages: ChatMessage[],
  project: Project,
  moduleItem?: ModuleItem,
): Promise<string> {
  let buf = "";
  await chatStream(messages, project, moduleItem, (c) => { buf += c; });
  return buf;
}

/* -------------------------- Mock 回退 -------------------------- */

function mockReply(messages: ChatMessage[], project: Project, m?: ModuleItem): ChatMessage {
  const last = messages[messages.length - 1];
  const head = m
    ? `**${project.name} → ${m.title}**\n\n基于「${last?.content || "继续展开"}」：\n`
    : `**${project.name}**\n\n`;
  const body = m
    ? [
        `1. 关键判断：${m.summary}`,
        `2. 落地建议：${m.bullets.slice(0, 3).map((b) => `\n   - ${b}`).join("")}`,
        `3. 可落地产物：${m.deliverables.join("、")}`,
        `4. 风险：${m.risks.join("；")}`,
      ].join("\n")
    : "请先选择一个模块以获得更具体的展开。";
  return {
    id: uid("msg"),
    role: "assistant",
    content: head + body,
    timestamp: new Date().toISOString(),
    contextModuleId: m?.id,
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
