import { NextRequest, NextResponse } from "next/server";
import { chatCompletionStream } from "@/lib/llm";
import { mockReply } from "@/lib/mock-api";
import { ChatMessage, ModuleItem, Project } from "@/lib/types";
import { uid } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { messages, project, module } = await req.json() as {
      messages: ChatMessage[];
      project: Project;
      module?: ModuleItem;
    };

    // 构建上下文
    const moduleContext = module
      ? `\n当前聚焦模块：${module.title}\n模块摘要：${module.summary}\n模块详情：${module.detail}`
      : "";

    const projectContext = `项目：${project.name} | 行业：${project.industry} | 场景：${project.scenario}`;

    const systemPrompt = `你是 AI 转型咨询专家，请基于以下项目信息回答用户问题。
${projectContext}
${moduleContext}

请用专业、简洁的方式回答。如果涉及到具体模块，应该给出可落地的建议。`;

    const chatMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    // 流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullText = "";
          await chatCompletionStream(chatMessages, {}, (chunk) => {
            fullText += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk })}\n\n`));
          });
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        } catch (err: any) {
          console.error("[chat] stream error:", err);
          // 出错时回退到 mock
          const mock = mockReply(messages, project, module);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: mock.content })}\n\n`));
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("[chat] error:", err);
    return NextResponse.json(
      { error: err?.message || "对话失败" },
      { status: 500 },
    );
  }
}
