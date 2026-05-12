"use client";
import { ModuleItem } from "@/lib/types";
import { Button } from "./ui/button";
import { Badge } from "./ui/primitives";
import { cn } from "@/lib/utils";
import { X, MessageSquare, FileText, ListChecks } from "lucide-react";

interface Props {
  open: boolean;
  module?: ModuleItem;
  onClose: () => void;
  onDiscuss: (m: ModuleItem) => void;
  onGenerateDoc: (m: ModuleItem) => void;
}

export function ModuleDetailDrawer({ open, module, onClose, onDiscuss, onGenerateDoc }: Props) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-ink-900/20 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-[560px] max-w-[96vw] flex-col border-l border-ink-300/60 bg-white shadow-pop transition-transform",
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
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 scrollbar-thin">
            <Block title="一句话摘要">
              <p className="text-sm leading-relaxed text-ink-700">{module.summary}</p>
              {module.tags && module.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {module.tags.map((t) => <Badge key={t} tone="brand">{t}</Badge>)}
                </div>
              )}
            </Block>

            <Block title="详细拆解">
              <pre className="whitespace-pre-wrap rounded-lg border border-ink-300/60 bg-ink-50/70 p-4 text-[13px] leading-relaxed text-ink-700">
                {module.detail}
              </pre>
            </Block>

            <Block title="关键判断">
              <ul className="space-y-1.5 text-[13px] text-ink-700">
                {module.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </Block>

            <Block title="可落地产物" icon={<ListChecks className="h-4 w-4 text-brand" />}>
              <ul className="space-y-1.5 text-[13px] text-ink-700">
                {module.deliverables.map((d, i) => <li key={i}>· {d}</li>)}
              </ul>
            </Block>

            <Block title="风险提示">
              <ul className="space-y-1.5 text-[13px] text-rose-700">
                {module.risks.map((d, i) => <li key={i}>· {d}</li>)}
              </ul>
            </Block>

            <Block title="相关下一步">
              <div className="flex flex-wrap gap-1.5">
                {module.suggestedPrompts.map((p) => (
                  <Badge key={p} tone="default">{p}</Badge>
                ))}
              </div>
            </Block>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-ink-300/60 px-5 py-3">
          <Button variant="primary" onClick={() => module && onDiscuss(module)}>
            <MessageSquare className="h-4 w-4" /> 继续和 AI 讨论
          </Button>
          <Button variant="outline" onClick={() => module && onGenerateDoc(module)}>
            <FileText className="h-4 w-4" /> 生成文档
          </Button>
          <Button variant="ghost" className="ml-auto">添加到方案大纲</Button>
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
