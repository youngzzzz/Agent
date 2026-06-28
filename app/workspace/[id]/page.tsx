"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { LayerSection } from "@/components/layer-section";
import { ChatDrawer } from "@/components/chat-drawer";
import { ModuleDetailDrawer } from "@/components/module-detail-drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { useProjectStore } from "@/lib/store";
import { useTemplateStore } from "@/lib/template-store";
import { ModuleItem } from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import { useGeneration } from "@/components/generation-provider";
import { formatDate } from "@/lib/utils";
import { RefreshCcw, BookMarked, Download, Share2, Loader2, Clock, ArrowRight } from "lucide-react";

export default function WorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { startGeneration } = useGeneration();
  const project = useProjectStore((s) => s.projects.find((p) => p.id === params.id));
  const upsert = useProjectStore((s) => s.upsertProject);
  const addTemplate = useTemplateStore((s) => s.addTemplate);

  const [chatOpen, setChatOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [chatFromDetail, setChatFromDetail] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleItem | undefined>();
  const [regenModal, setRegenModal] = useState(false);

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

  if (project.status === "generating") {
    return (
      <div className="min-h-screen">
        <TopNav />
        <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
          <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <Loader2 className="h-7 w-7 animate-spin" />
          </span>
          <h2 className="text-lg font-semibold text-ink-900">方案生成中，请耐心等待</h2>
          <p className="mt-2 max-w-md text-sm text-ink-500">
            「{project.name}」正在后台生成四层拆解方案，预计需要 1–2 分钟。
            完成后会自动更新本页并通知你，期间可以先去做别的事。
          </p>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/history")}>
              返回历史项目
            </Button>
            <Button size="sm" onClick={() => router.refresh()}>
              <RefreshCcw className="h-3.5 w-3.5" /> 刷新查看
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const onJump = (id: string) => {
    document.getElementById(`layer-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 直接从模块卡片进入「和 AI 讨论」（无返回按钮）
  const onDiscuss = (m: ModuleItem) => {
    setActiveModule(m);
    setChatFromDetail(false);
    setDetailOpen(false);
    setChatOpen(true);
  };

  // 从「深入分析」切到「和 AI 讨论」：保留深入分析在底层，聊天抽屉滑入覆盖其上
  const onDiscussFromDetail = (m: ModuleItem) => {
    setActiveModule(m);
    setChatFromDetail(true);
    setChatOpen(true);
  };

  // 从「和 AI 讨论」返回「深入分析」：聊天滑出，底层的深入分析自然显露
  const onBackToDetail = () => {
    setChatOpen(false);
  };

  // 关闭「和 AI 讨论」：若是叠加在深入分析之上，连同底层一起关闭
  const onCloseChat = () => {
    setChatOpen(false);
    if (chatFromDetail) setDetailOpen(false);
    setChatFromDetail(false);
  };

  const onDetail = (m: ModuleItem) => {
    setActiveModule(m);
    setDetailOpen(true);
  };

  const onSaveTemplate = () => {
    if (project.status !== "generated") {
      toast("方案尚未生成完成，暂不能保存为模板");
      return;
    }
    const now = new Date().toISOString();
    const snapshot = { ...project, updatedAt: now };
    // 同时刷新历史项目，并写入模板库
    upsert(snapshot);
    addTemplate({
      id: `tpl-${project.id}`,
      name: project.name,
      industry: project.industry,
      scenario: project.scenario,
      outputPurpose: project.outputPurpose,
      depth: project.depth,
      painPoints: project.painPoints,
      savedAt: now,
      sourceProjectId: project.id,
      project: snapshot,
    });
    toast("已保存到模板库，可前往模板库生成 PPT");
  };

  const onRegenerate = () => {
    startGeneration(
      {
        industry: project.industry,
        scenario: project.scenario,
        targetUser: project.targetUser,
        painPoints: project.painPoints,
        outputPurpose: project.outputPurpose,
        depth: project.depth,
      },
      { projectId: project.id, name: project.name, createdAt: project.createdAt },
    );
    setRegenModal(true);
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
        <main className={`flex-1 bg-ink-50 scrollbar-thin ${chatOpen || detailOpen ? "overflow-hidden" : "overflow-y-auto"}`}>
          <div className="sticky top-0 z-20 border-b border-ink-300/60 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-6 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-base font-semibold text-ink-900">{project.name}</h2>
                  {project.status === "failed" ? (
                    <Badge tone="danger">生成失败</Badge>
                  ) : project.status === "draft" ? (
                    <Badge tone="default">草稿</Badge>
                  ) : (
                    <Badge tone="success">已生成</Badge>
                  )}
                </div>
                <p className="text-[11px] text-ink-500">更新于 {formatDate(project.updatedAt)}</p>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={onRegenerate}>
                  <RefreshCcw className="h-3.5 w-3.5" /> 重新生成
                </Button>
                <Button size="sm" variant="outline" onClick={onSaveTemplate}>
                  <BookMarked className="h-3.5 w-3.5" /> 保存模板
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

      <ModuleDetailDrawer
        open={detailOpen}
        module={activeModule}
        backdrop={!chatOpen}
        onClose={() => setDetailOpen(false)}
        onDiscuss={onDiscussFromDetail}
        onGenerateDoc={() => toast("已生成文档草稿")}
      />
      <ChatDrawer
        open={chatOpen}
        project={project}
        module={activeModule}
        onClose={onCloseChat}
        onBack={chatFromDetail ? onBackToDetail : undefined}
      />

      <Modal
        open={regenModal}
        onClose={() => setRegenModal(false)}
        icon={
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand">
            <Clock className="h-4 w-4" />
          </span>
        }
        title="重新生成任务已创建"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setRegenModal(false)}>
              知道了
            </Button>
            <Button size="sm" onClick={() => router.push("/history")}>
              查看方案生成进度 <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </>
        }
      >
        <p>
          <span className="font-medium text-ink-900">「{project.name}」</span>
          正在后台重新生成，预计需要 1–2 分钟，完成后会通知你并自动更新内容。
        </p>
      </Modal>
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
