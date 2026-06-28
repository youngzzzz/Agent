import { ChatMessage, GenerateAnalysisInput, ModuleItem, Project } from "./types";
import { buildProject } from "./mock-data";
import { uid } from "./utils";
import { isFlowchartRequest } from "./parse-message";

/**
 * 是否启用真实 LLM。默认 true：调用 /api/generate 与 /api/chat。
 * 设为 false 可强制走本地 mock（演示 / 离线开发）。
 */
const USE_REAL_LLM = process.env.NEXT_PUBLIC_USE_REAL_LLM !== "false";

/* -------------------------- 生成四层拆解 -------------------------- */

export async function mockGenerateAnalysis(input: GenerateAnalysisInput): Promise<Project> {
  if (USE_REAL_LLM) {
    return await generateAnalysisWithLLM(input);
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
        const delta = json?.delta;
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {
        // 忽略解析失败的心跳/空行
      }
    }
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

export function mockReply(messages: ChatMessage[], project: Project, m?: ModuleItem): ChatMessage {
  const last = messages[messages.length - 1];
  const query = last?.content || "继续展开";

  if (!m) {
    return {
      id: uid("msg"),
      role: "assistant",
      content: "请先选择一个模块以获得更具体的展开。",
      timestamp: new Date().toISOString(),
    };
  }

  if (isFlowchartRequest(query)) {
    const content = buildFlowchartReply(project, m);
    return {
      id: uid("msg"),
      role: "assistant",
      content,
      timestamp: new Date().toISOString(),
      contextModuleId: m.id,
    };
  }

  const content = [
    `## ${project.name} → ${m.title}`,
    "",
    `> ${m.summary}`,
    "",
    "### 关键判断",
    ...m.bullets.slice(0, 4).map((b) => `- ${b}`),
    "",
    "### 落地建议",
    `- 优先验证：${m.deliverables[0] || "最小可行实验"}`,
    `- 关注风险：${m.risks.slice(0, 2).join("；") || "数据与预期管理"}`,
    `- 下一步：结合「${query}」继续细化可执行动作`,
  ].join("\n");

  return {
    id: uid("msg"),
    role: "assistant",
    content,
    timestamp: new Date().toISOString(),
    contextModuleId: m.id,
  };
}

function buildFlowchartReply(project: Project, m: ModuleItem): string {
  const root = m.title.slice(0, 14);
  const scenario = project.scenario.slice(0, 16);
  const deliverable = (m.deliverables[0] || "方案交付").slice(0, 14);
  const branchLines = m.bullets.slice(0, 3).map((b, i) => {
    const label = b.slice(0, 16).replace(/[\[\]()]/g, "");
    return `    分支${i + 1}\n      ${label}`;
  });

  const mindmap = [
    "mindmap",
    `  root((${root}))`,
    "    输入触发",
    `      ${scenario}`,
    "    核心处理",
    `      ${m.title.slice(0, 14)}`,
    ...branchLines,
    "    输出验证",
    `      ${deliverable}`,
  ].join("\n");

  return [
    `## ${m.title} · 流程图`,
    "",
    `> ${m.summary}`,
    "",
    "```mermaid",
    mindmap,
    "```",
    "",
    "### 说明",
    "- 思维导图展示从输入、处理到输出的主路径",
    "- 可在各分支继续追问「继续展开」获得子流程细节",
  ].join("\n");
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
