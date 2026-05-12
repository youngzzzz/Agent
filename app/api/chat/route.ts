import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ChatMessage, ModuleItem, Project } from "@/lib/types";
import { SYSTEM_CHAT, buildChatContext } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic();

interface ChatPayload {
  messages: ChatMessage[];
  project: Project;
  module?: ModuleItem;
}

/**
 * 流式返回纯文本（SSE-like 简单文本流）。
 * 前端用 ReadableStream 增量读取并拼接到聊天气泡。
 */
export async function POST(req: NextRequest) {
  try {
    const { messages, project, module } = (await req.json()) as ChatPayload;

    const ctx = buildChatContext(project, module);

    // System block 拆成两段：固定指令 + 项目/模块上下文。
    // 固定指令打 cache_control，跨请求复用前缀（同一会话多轮成本显著下降）。
    const system: Anthropic.TextBlockParam[] = [
      { type: "text", text: SYSTEM_CHAT, cache_control: { type: "ephemeral" } },
      { type: "text", text: ctx },
    ];

    const apiMessages: Anthropic.MessageParam[] = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    const upstream = client.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 8000,
      // adaptive thinking + effort 在新版 SDK 才有完整类型，这里做局部放宽
      thinking: { type: "adaptive" } as any,
      output_config: { effort: "medium" } as any,
      system,
      messages: apiMessages,
    } as any);

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          upstream.on("text", (delta) => {
            controller.enqueue(encoder.encode(delta));
          });
          await upstream.finalMessage();
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: any) {
    console.error("[/api/chat]", err);
    return new Response(JSON.stringify({ error: err?.message ?? "Internal error" }), {
      status: err?.status ?? 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
