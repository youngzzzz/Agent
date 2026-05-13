"use client";
import { ModuleItem } from "@/lib/types";
import { Badge, Card } from "./ui/primitives";
import { Button } from "./ui/button";
import { MessageSquare, ArrowRight } from "lucide-react";

interface Props {
  module: ModuleItem;
  primaryActions?: { label: string; onClick: () => void }[];
  onDiscuss: () => void;
  onDetail: () => void;
}

export function ModuleCard({ module, primaryActions, onDiscuss, onDetail }: Props) {
  return (
    <Card className="flex h-full flex-col p-5 transition-all hover:border-brand/40 hover:shadow-pop">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h4 className="text-[15px] font-semibold text-ink-900">{module.title}</h4>
      </div>
      <p className="mb-3 text-sm leading-relaxed text-ink-500">{module.summary}</p>
      {module.tags && module.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {module.tags.map((t) => (
            <Badge key={t} tone="brand">{t}</Badge>
          ))}
        </div>
      )}
      <ul className="mb-4 space-y-1.5 text-[13px] text-ink-700">
        {(module.bullets || []).slice(0, 4).map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-300" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onDetail}>
          深入分析 <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        {primaryActions?.slice(0, 1).map((a) => (
          <Button key={a.label} size="sm" variant="subtle" onClick={a.onClick}>{a.label}</Button>
        ))}
        <Button size="sm" variant="ghost" onClick={onDiscuss} className="ml-auto text-brand-700 hover:bg-brand-50">
          <MessageSquare className="h-3.5 w-3.5" /> 和 AI 讨论
        </Button>
      </div>
    </Card>
  );
}
