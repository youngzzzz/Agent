"use client";
import { Layer, ModuleItem } from "@/lib/types";
import { ModuleCard } from "./module-card";
import { Briefcase, Brain, LayoutDashboard, Rocket } from "lucide-react";

const layerIcon = {
  business: Briefcase,
  ai: Brain,
  product: LayoutDashboard,
  delivery: Rocket,
} as const;

const primaryByLayer: Record<string, string[]> = {
  business: ["和业务方对齐"],
  ai: ["生成技术方案"],
  product: ["生成 PRD"],
  delivery: ["生成交付方案"],
};

interface Props {
  layer: Layer;
  onDiscuss: (m: ModuleItem) => void;
  onDetail: (m: ModuleItem) => void;
}

export function LayerSection({ layer, onDiscuss, onDetail }: Props) {
  const Icon = layerIcon[layer.id];
  return (
    <section id={`layer-${layer.id}`} className="scroll-mt-20">
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-ink-900">{layer.title}</h3>
          <p className="mt-0.5 text-sm text-ink-500">{layer.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {layer.modules.map((m) => (
          <ModuleCard
            key={m.id}
            module={m}
            primaryActions={primaryByLayer[layer.id].map((label) => ({
              label,
              onClick: () => onDiscuss(m),
            }))}
            onDiscuss={() => onDiscuss(m)}
            onDetail={() => onDetail(m)}
          />
        ))}
      </div>
    </section>
  );
}
