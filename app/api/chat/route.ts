import { NextRequest } from "next/server";
import { ChatMessage, ModuleItem, Project } from "@/lib/types";
import { SYSTEM_CHAT, buildChatContext } from "@/lib/prompts";
import { getLLMClient, getModelName } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatPayload {
  messages: ChatMessage[];
  project: Project;
  module?: ModuleItem;
}

/**
 * 流式返回纯文本（OpenAI 兼容协议的 stream=true）。
 * 前端用 ReadableStream 增量读取，支持打字机效果。
 */
export async function POST(req: NextRequest) {
  try {
    const { messages, project, module } = (await req.json()) as ChatPayload;

    const client = getLLMClient();
    const model = getModelName();

    const systemContent = `${SYSTEM_CHAT}\n\n${buildChatContext(project, module)}`;

    const apiMessages = [
      { role: "system" as const, content: systemContent },
      ...messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content })),
    ];

    const stream = await client.chat.completions.create({
      model,
      stream: true,
      temperature: 0.7,
      max_tokens: 4000,
      messages: apiMessages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          }
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
