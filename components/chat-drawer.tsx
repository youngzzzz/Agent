"use client";
import { useEffect, useRef, useState } from "react";
import { ChatMessage, ModuleItem, Project } from "@/lib/types";
import { chatWithModuleContext } from "@/lib/mock-api";
import { Button } from "./ui/button";
import { Badge } from "./ui/primitives";
import { uid, cn } from "@/lib/utils";
import { Send, X, Sparkles } from "lucide-react";

const QUICK = [
  "继续展开",
  "生成 PRD",
  "生成流程图",
  "生成技术方案",
  "转成作品集",
  "转成咨询方案",
  "给出面试讲法",
];

interface Props {
  open: boolean;
  project: Project;
  module?: ModuleItem;
  onClose: () => void;
}

export function ChatDrawer({ open, project, module, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // reset on module change
  useEffect(() => {
    if (module) {
      setMessages([
        {
          id: uid("msg"),
          role: "assistant",
          content: `已聚焦到「${module.title}」。你可以追问这个模块的任何细节，或使用下方快捷指令快速生成产物。`,
          timestamp: new Date().toISOString(),
          contextModuleId: module.id,
        },
      ]);
    }
  }, [module?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || loading) return;
    const userMsg: ChatMessage = {
      id: uid("msg"), role: "user", content: t,
      timestamp: new Date().toISOString(), contextModuleId: module?.id,
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    const reply = await chatWithModuleContext([...messages, userMsg], project, module);
    setMessages((m) => [...m, reply]);
    setLoading(false);
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-ink-900/10 backdrop-blur-[1px] transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-[380px] max-w-[92vw] flex-col border-l border-ink-300/60 bg-white shadow-pop transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-ink-300/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 text-brand">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-900">和 AI 讨论</p>
              <p className="text-[11px] text-ink-500">{project.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {module && (
          <div className="border-b border-ink-300/60 bg-ink-50/60 px-4 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-ink-500">当前上下文</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge tone="brand">{layerLabel(module.layerId)}</Badge>
              <Badge>{module.title}</Badge>
            </div>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 scrollbar-thin">
          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[13px] leading-relaxed",
                  m.role === "user"
                    ? "bg-brand text-white"
                    : "border border-ink-300/60 bg-white text-ink-700",
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-lg border border-ink-300/60 bg-white px-3 py-2 text-[13px] text-ink-500">
                AI 正在思考…
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-ink-300/60 px-3 py-2">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="rounded-full border border-ink-300/70 bg-white px-2.5 py-0.5 text-[11px] text-ink-700 hover:border-brand/50 hover:bg-brand-50 hover:text-brand-700"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="继续追问这个模块，例如：帮我展开成 PRD / 帮我做成面试表达 / 帮我生成页面流程"
              className="min-h-[60px] flex-1 resize-none rounded-lg border border-ink-300/70 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-500 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <Button onClick={() => send(input)} disabled={loading} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

function layerLabel(id: string) {
  return ({ business: "业务层", ai: "AI 应用层", product: "产品层", delivery: "交付层" } as any)[id] || id;
}
