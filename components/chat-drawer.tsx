"use client";
import { useEffect, useRef, useState } from "react";
import { ChatMessage, ModuleItem, Project } from "@/lib/types";
import { chatWithModuleContext } from "@/lib/mock-api";
import { Button } from "./ui/button";
import { Badge } from "./ui/primitives";
import { ChatMessageRenderer } from "./chat-message-renderer";
import {
  CHAT_STYLE_OPTIONS,
  ChatRenderStyle,
  parseMessageContent,
} from "@/lib/parse-message";
import { uid, cn } from "@/lib/utils";
import { lockBodyScroll } from "@/lib/scroll-lock";
import { Send, X, Sparkles, Palette, ArrowLeft } from "lucide-react";

const QUICK = [
  "继续展开",
  "竞品分析",
  "生成 PRD",
  "生成流程图",
  "生成技术方案",
  "转成咨询方案",
];

const STYLE_STORAGE_KEY = "chat-render-style";

interface Props {
  open: boolean;
  project: Project;
  module?: ModuleItem;
  onClose: () => void;
  /** 从「深入分析」进入时传入，渲染返回按钮以回到深入分析 */
  onBack?: () => void;
}

export function ChatDrawer({ open, project, module, onClose, onBack }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [renderStyle, setRenderStyle] = useState<ChatRenderStyle>("notion");
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STYLE_STORAGE_KEY) as ChatRenderStyle | null;
    if (saved && CHAT_STYLE_OPTIONS.some((o) => o.id === saved)) {
      setRenderStyle(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STYLE_STORAGE_KEY, renderStyle);
  }, [renderStyle]);

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

  // 抽屉打开时锁定背景滚动：滚轮只作用于聊天框，不会滚动方案页
  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

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
          "fixed inset-0 z-[55] overscroll-contain bg-ink-900/40 backdrop-blur-[1px] transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-[60] flex h-full w-1/3 min-w-[360px] max-w-[92vw] flex-col border-l border-ink-300/60 bg-white shadow-pop transition-transform duration-300 ease-out",
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
          <div className="flex items-center gap-1">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                title="回复样式"
                onClick={() => setStyleMenuOpen((v) => !v)}
              >
                <Palette className="h-4 w-4" />
              </Button>
              {styleMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setStyleMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1 w-[220px] rounded-lg border border-ink-200/80 bg-white p-1.5 shadow-pop">
                    <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-ink-500">
                      AI 回复样式
                    </p>
                    {CHAT_STYLE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setRenderStyle(opt.id);
                          setStyleMenuOpen(false);
                        }}
                        className={cn(
                          "w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-ink-50",
                          renderStyle === opt.id && "bg-brand-50",
                        )}
                      >
                        <p className="text-xs font-medium text-ink-900">{opt.label}</p>
                        <p className="text-[10px] text-ink-500">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {onBack && (
              <Button variant="ghost" size="icon" title="返回深入分析" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </div>

        {module && (
          <div className="border-b border-ink-300/60 bg-ink-50/60 px-4 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-ink-500">当前上下文</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge tone="brand">{layerLabel(module.layerId)}</Badge>
              <Badge>{module.title}</Badge>
              <Badge tone="default">{CHAT_STYLE_OPTIONS.find((o) => o.id === renderStyle)?.label}</Badge>
            </div>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 scrollbar-thin">
          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "user" ? (
                <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-brand px-3 py-2 text-[13px] leading-relaxed text-white">
                  {m.content}
                </div>
              ) : (
                <div className="max-w-[95%] min-w-0">
                  {m.content.startsWith("已聚焦到") && messages.indexOf(m) === 0 ? (
                    <div className="rounded-lg border border-ink-300/60 bg-ink-50/80 px-3 py-2 text-[13px] leading-relaxed text-ink-600">
                      {m.content}
                    </div>
                  ) : (
                    <ChatMessageRenderer
                      content={m.content}
                      style={renderStyle}
                      blocks={parseMessageContent(m.content)}
                    />
                  )}
                </div>
              )}
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
              placeholder="继续追问这个模块，例如：帮我展开成 PRD / 帮我生成页面流程"
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
