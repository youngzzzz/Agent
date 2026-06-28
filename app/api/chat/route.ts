import { NextRequest, NextResponse } from "next/server";
import { chatCompletionStream } from "@/lib/llm";
import {
  chatCompletionWithWebSearch,
  WEB_SEARCH_CHAT_SYSTEM_APPEND,
} from "@/lib/llm-agent";
import { mockReply } from "@/lib/mock-api";
import { isWebSearchEnabled } from "@/lib/web-search";
import { runLlmWithFallback } from "@/lib/llm-fallback";
import { acquireLlmSlot, getClientIp, OverloadedError } from "@/lib/concurrency";
import { ChatMessage, ModuleItem, Project } from "@/lib/types";

// 强制 Node 运行时，并放宽函数最大执行时长，避免联网检索 / 长回复被默认超时中断。
export const runtime = "nodejs";
export const maxDuration = 300;

const CHAT_FORMAT_RULES = `
回复格式要求：
- 使用结构化 Markdown，不要用大段纯文本
- 章节用 ## 或 ###，子章节用 ####（不要用裸露的 # 符号当正文）
- 也可用中文序号作章节，如「六、风险与对冲」
- 要点用 - 列表；对比/风险用 Markdown 表格（| 列1 | 列2 |）
- 用 > 引用块强调 1-2 条关键判断
- 行内强调用 **加粗**，术语用 \`代码\` 样式

当用户要求「生成流程图」时，必须输出 \`\`\`mermaid 代码块（mindmap 或 flowchart TB），节点用中文。
流程图代码块之外附 2-3 句说明。`;

const SSE_CHUNK_SIZE = 48;

function enqueueSseDelta(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  delta: string,
) {
  controller.enqueue(
    encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`),
  );
}

/** 联网检索完成后，将完整文本分块推送以保持打字机效果 */
function streamTextAsSse(
  text: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
) {
  for (let i = 0; i < text.length; i += SSE_CHUNK_SIZE) {
    enqueueSseDelta(controller, encoder, text.slice(i, i + SSE_CHUNK_SIZE));
  }
}

export async function POST(req: NextRequest) {
  let release: (() => void) | null = null;
  try {
    const { messages, project, module } = (await req.json()) as {
      messages: ChatMessage[];
      project: Project;
      module?: ModuleItem;
    };

    // 并发闸：申请执行槽位，拥塞时抛 OverloadedError → 返回 503/429
    release = await acquireLlmSlot(getClientIp(req));

    const moduleContext = module
      ? `\n当前聚焦模块：${module.title}\n模块摘要：${module.summary}\n模块详情：${module.detail}`
      : "";

    const projectContext = `项目：${project.name} | 行业：${project.industry} | 场景：${project.scenario}`;

    let systemPrompt = `你是 AI 转型咨询专家，请基于以下项目信息回答用户问题。
${projectContext}
${moduleContext}

请用专业、简洁、可落地的方式回答。如果涉及到具体模块，应该给出可落地的建议。
${CHAT_FORMAT_RULES}`;

    if (isWebSearchEnabled()) {
      systemPrompt += WEB_SEARCH_CHAT_SYSTEM_APPEND;
    }

    const chatMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const encoder = new TextEncoder();
    const useWebSearch = isWebSearchEnabled();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (useWebSearch) {
            const llmStart = Date.now();
            const { text, webSearchUsed, strategy, searchRounds } =
              await runLlmWithFallback((c) =>
                chatCompletionWithWebSearch(chatMessages, { max_tokens: 8000 }, c),
              );
            console.info(
              `[chat] LLM ${Date.now() - llmStart}ms webSearch=${webSearchUsed} strategy=${strategy} rounds=${searchRounds}`,
            );
            streamTextAsSse(text, controller, encoder);
          } else {
            await runLlmWithFallback((c) =>
              chatCompletionStream(chatMessages, { max_tokens: 8000 }, (chunk) => {
                enqueueSseDelta(controller, encoder, chunk);
              }, c),
            );
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err: any) {
          console.error("[chat] stream error:", err);
          const mock = mockReply(messages, project, module);
          enqueueSseDelta(controller, encoder, mock.content);
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } finally {
          release?.();
          release = null;
        }
      },
      cancel() {
        release?.();
        release = null;
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    release?.();
    if (err instanceof OverloadedError) {
      console.warn(`[chat] overloaded: ${err.message}`);
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[chat] error:", err);
    return NextResponse.json(
      { error: err?.message || "对话失败" },
      { status: 500 },
    );
  }
}
