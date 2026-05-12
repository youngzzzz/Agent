"use client";
import { Project } from "@/lib/types";
import {
  Briefcase, Brain, LayoutDashboard, Rocket, FileText,
  Workflow, LayoutPanelLeft, Cpu, Target, DollarSign, History, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

const layerIcons = {
  business: Briefcase,
  ai: Brain,
  product: LayoutDashboard,
  delivery: Rocket,
} as const;

const layerLabels = {
  business: "业务层",
  ai: "AI 应用层",
  product: "产品层",
  delivery: "交付层",
} as const;

const deliverables = [
  { icon: FileText, label: "PRD" },
  { icon: Workflow, label: "用户流程" },
  { icon: LayoutPanelLeft, label: "页面模块" },
  { icon: Cpu, label: "技术架构" },
  { icon: Target, label: "MVP 计划" },
  { icon: DollarSign, label: "商业化方案" },
];

interface Props {
  project: Project;
  onJump: (layer: string) => void;
}

export function WorkspaceSidebar({ project, onJump }: Props) {
  return (
    <aside className="hidden w-[260px] shrink-0 border-r border-ink-300/60 bg-white lg:block">
      <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
        <div className="border-b border-ink-300/60 px-4 py-4">
          <p className="text-[11px] uppercase tracking-wider text-ink-500">当前项目</p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-ink-900">{project.name}</p>
        </div>

        <SectionTitle>四层导航</SectionTitle>
        <div className="px-2">
          {(Object.keys(layerLabels) as Array<keyof typeof layerLabels>).map((k) => {
            const Icon = layerIcons[k];
            return (
              <button
                key={k}
                onClick={() => onJump(k)}
                className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink-700 hover:bg-ink-50"
              >
                <Icon className="h-4 w-4 text-brand" />
                <span>{layerLabels[k]}</span>
              </button>
            );
          })}
        </div>

        <SectionTitle>生成物</SectionTitle>
        <div className="px-2">
          {deliverables.map((d) => (
            <button
              key={d.label}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink-700 hover:bg-ink-50"
            >
              <d.icon className="h-4 w-4 text-ink-500" />
              <span>{d.label}</span>
            </button>
          ))}
        </div>

        <SectionTitle>其他</SectionTitle>
        <div className="px-2 pb-4">
          <SidebarItem icon={History} label="历史版本" />
          <SidebarItem icon={Download} label="导出" />
        </div>
      </div>
    </aside>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pb-1 pt-4 text-[11px] uppercase tracking-wider text-ink-500">{children}</p>
  );
}

function SidebarItem({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-700 hover:bg-ink-50")}>
      <Icon className="h-4 w-4 text-ink-500" />
      <span>{label}</span>
    </div>
  );
}
