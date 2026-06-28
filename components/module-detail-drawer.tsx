"use client";
import { useEffect } from "react";
import { ModuleItem } from "@/lib/types";
import { lockBodyScroll } from "@/lib/scroll-lock";
import { parseMessageContent, segmentParagraphBlocks } from "@/lib/parse-message";
import { Button } from "./ui/button";
import { Badge } from "./ui/primitives";
import { ChatMessageRenderer } from "./chat-message-renderer";
import { cn } from "@/lib/utils";
import { X, MessageSquare, FileText, ListChecks } from "lucide-react";

interface Props {
  open: boolean;
  module?: ModuleItem;
  onClose: () => void;
  onDiscuss: (m: ModuleItem) => void;
  onGenerateDoc: (m: ModuleItem) => void;
  /** 是否显示背景遮罩；当聊天抽屉叠加其上时置 false，避免遮罩叠加变暗 */
  backdrop?: boolean;
}

export function ModuleDetailDrawer({ open, module, onClose, onDiscuss, onGenerateDoc, backdrop = true }: Props) {
  // 抽屉打开时锁定背景滚动：滚轮只作用于深入分析抽屉，不会滚动方案页
  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 overscroll-contain bg-ink-900/40 backdrop-blur-[1px] transition-opacity",
          open && backdrop ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-1/3 min-w-[360px] max-w-[92vw] flex-col border-l border-ink-300/60 bg-white shadow-pop transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-ink-300/60 px-5 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-500">模块详情</p>
            <p className="text-sm font-semibold text-ink-900">{module?.title}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {module && (
          <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 scrollbar-thin">
            <Block title="一句话摘要">
              <p className="text-sm leading-relaxed text-ink-700">{module.summary}</p>
              {module.tags && module.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(module.tags || []).map((t) => <Badge key={t} tone="brand">{t}</Badge>)}
                </div>
              )}
            </Block>

            <Block title="详细拆解">
              <ChatMessageRenderer
                content={module.detail}
                style="notion"
                blocks={segmentParagraphBlocks(parseMessageContent(module.detail))}
              />
            </Block>

            <Block title="关键判断">
              <ul className="space-y-1.5 text-[13px] text-ink-700">
                {module.bullets && (module.bullets || []).map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </Block>

            <Block title="可落地产物" icon={<ListChecks className="h-4 w-4 text-brand" />}>
              <ul className="space-y-1.5 text-[13px] text-ink-700">
                {(module.deliverables || []).map((d, i) => <li key={i}>· {d}</li>)}
              </ul>
            </Block>

            <Block title="风险提示">
              <ul className="space-y-1.5 text-[13px] text-rose-700">
                {(module.risks || []).map((d, i) => <li key={i}>· {d}</li>)}
              </ul>
            </Block>

            <Block title="相关下一步">
              <div className="flex flex-wrap gap-1.5">
                {(module.suggestedPrompts || []).map((p) => (
                  <Badge key={p} tone="default">{p}</Badge>
                ))}
              </div>
            </Block>
          </div>
        )}

        <div className="flex items-center gap-1.5 border-t border-ink-300/60 px-3 py-2.5">
          <Button
            size="sm"
            variant="primary"
            className="min-w-0 flex-1 gap-1 whitespace-nowrap px-2 text-xs"
            onClick={() => module && onDiscuss(module)}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0" /> 继续讨论
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-w-0 flex-1 gap-1 whitespace-nowrap px-2 text-xs"
            onClick={() => module && onGenerateDoc(module)}
          >
            <FileText className="h-3.5 w-3.5 shrink-0" /> 生成文档
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="min-w-0 flex-1 whitespace-nowrap px-2 text-xs"
          >
            加入大纲
          </Button>
        </div>
      </aside>
    </>
  );
}

function Block({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <h5 className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">{title}</h5>
      </div>
      {children}
    </div>
  );
}
