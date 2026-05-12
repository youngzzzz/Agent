"use client";
import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { LayerSection } from "@/components/layer-section";
import { ChatDrawer } from "@/components/chat-drawer";
import { ModuleDetailDrawer } from "@/components/module-detail-drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { useProjectStore } from "@/lib/store";
import { ModuleItem } from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import { mockGenerateAnalysis } from "@/lib/mock-api";
import { formatDate } from "@/lib/utils";
import { RefreshCcw, Save, Download, Share2 } from "lucide-react";

export default function WorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const project = useProjectStore((s) => s.projects.find((p) => p.id === params.id));
  const upsert = useProjectStore((s) => s.upsertProject);

  const [chatOpen, setChatOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleItem | undefined>();

  if (!project) {
    return (
      <div className="min-h-screen">
        <TopNav />
        <div className="mx-auto max-w-2xl px-6 py-20 text-center">
          <p className="text-sm text-ink-500">未找到该项目</p>
          <Button className="mt-4" onClick={() => router.push("/")}>返回首页</Button>
        </div>
      </div>
    );
  }

  const onJump = (id: string) => {
    document.getElementById(`layer-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onDiscuss = (m: ModuleItem) => {
    setActiveModule(m);
    setChatOpen(true);
    setDetailOpen(false);
  };

  const onDetail = (m: ModuleItem) => {
    setActiveModule(m);
    setDetailOpen(true);
  };

  const onSave = () => {
    upsert({ ...project, updatedAt: new Date().toISOString() });
    toast("已保存到历史项目");
  };

  const onRegenerate = async () => {
    const np = await mockGenerateAnalysis({
      industry: project.industry,
      scenario: project.scenario,
      targetUser: project.targetUser,
      painPoints: project.painPoints,
      outputPurpose: project.outputPurpose,
      depth: project.depth,
    });
    upsert({ ...np, id: project.id, name: project.name, createdAt: project.createdAt });
    toast("已重新生成方案");
  };

  const onExportMd = () => {
    const md = projectToMarkdown(project);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${project.name}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("已导出 Markdown");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <WorkspaceSidebar project={project} onJump={onJump} />
        <main className="flex-1 overflow-y-auto bg-ink-50 scrollbar-thin">
          <div className="sticky top-0 z-20 border-b border-ink-300/60 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-6 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-base font-semibold text-ink-900">{project.name}</h2>
                  <Badge tone="success">已生成</Badge>
                </div>
                <p className="text-[11px] text-ink-500">更新于 {formatDate(project.updatedAt)}</p>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={onRegenerate}>
                  <RefreshCcw className="h-3.5 w-3.5" /> 重新生成
                </Button>
                <Button size="sm" variant="outline" onClick={onSave}>
                  <Save className="h-3.5 w-3.5" /> 保存
                </Button>
                <Button size="sm" variant="outline" onClick={onExportMd}>
                  <Download className="h-3.5 w-3.5" /> 导出 Markdown
                </Button>
                <Button size="sm" variant="ghost" disabled>导出 PDF</Button>
                <Button size="sm" variant="ghost" disabled>
                  <Share2 className="h-3.5 w-3.5" /> 分享
                </Button>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-[1200px] space-y-12 px-6 py-8">
            {project.layers.map((l) => (
              <LayerSection key={l.id} layer={l} onDiscuss={onDiscuss} onDetail={onDetail} />
            ))}
          </div>
        </main>
      </div>

      <ChatDrawer
        open={chatOpen}
        project={project}
        module={activeModule}
        onClose={() => setChatOpen(false)}
      />
      <ModuleDetailDrawer
        open={detailOpen}
        module={activeModule}
        onClose={() => setDetailOpen(false)}
        onDiscuss={(m) => { setDetailOpen(false); onDiscuss(m); }}
        onGenerateDoc={() => toast("已生成文档草稿")}
      />
    </div>
  );
}

function projectToMarkdown(project: any) {
  let s = `# ${project.name}\n\n- 行业：${project.industry}\n- 场景：${project.scenario}\n- 输出用途：${project.outputPurpose}\n- 方案深度：${project.depth}\n\n`;
  for (const layer of project.layers) {
    s += `\n## ${layer.title}\n\n${layer.description}\n`;
    for (const m of layer.modules) {
      s += `\n### ${m.title}\n\n${m.summary}\n\n`;
      for (const b of m.bullets) s += `- ${b}\n`;
    }
  }
  return s;
}
