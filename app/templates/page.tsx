"use client";
import { useEffect } from "react";
import { TopNav } from "@/components/top-nav";
import { Card, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { PRESET_TEMPLATES } from "@/lib/mock-data";
import { mockGenerateAnalysis } from "@/lib/mock-api";
import { buildProjectPptxBlob, downloadPptxBlob } from "@/lib/ppt-export";
import {
  deletePptBlob,
  loadPptBlob,
  pptIdbKey,
  requestPersistentStorage,
  savePptBlob,
} from "@/lib/ppt-storage";
import { useProjectStore } from "@/lib/store";
import { useTemplateStore, savedTemplatePptKey } from "@/lib/template-store";
import { usePptStore, useNotifyStore } from "@/lib/notify-store";
import { useToast } from "@/components/ui/toast";
import { GenerateAnalysisInput, SavedTemplate } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Sparkles, Download, Loader2, FileText, BookMarked, Trash2, FolderOpen } from "lucide-react";

export default function TemplatesPage() {
  const upsert = useProjectStore((s) => s.upsertProject);
  const savedTemplates = useTemplateStore((s) => s.templates);
  const removeTemplate = useTemplateStore((s) => s.removeTemplate);
  const { toast } = useToast();
  const busy = usePptStore((s) => s.busy);
  const ready = usePptStore((s) => s.ready);

  // 提升 IndexedDB 留存率，降低被浏览器自动驱逐的概率
  useEffect(() => {
    requestPersistentStorage();
  }, []);

  function useTemplate(t: GenerateAnalysisInput) {
    const key = `${t.industry}｜${t.scenario}`;
    // 防重复发起：该模板正在生成时直接忽略
    if (usePptStore.getState().busy[key]) return;

    usePptStore.getState().setBusy(key, true);
    toast(`正在为「${t.scenario}」生成方案与 PPT，请稍候…`);

    // 异步执行：不阻塞 UI，离开页面也会继续完成并写入提醒/产物
    (async () => {
      try {
        const project = await mockGenerateAnalysis(t);
        upsert(project);
        const artifact = await buildProjectPptxBlob(project);
        const idbKey = pptIdbKey(key);
        await savePptBlob(idbKey, artifact.blob);
        usePptStore.getState().setReady(key, {
          fileName: artifact.fileName,
          createdAt: new Date().toISOString(),
          idbKey,
        });
        useNotifyStore.getState().add({
          kind: "ppt",
          title: t.scenario,
          message: `「${t.scenario}」模板已成功，可以在模板库下载`,
        });
        toast(`「${t.scenario}」模板已成功，可以在模板库下载`, { duration: 1000 });
      } catch (err: any) {
        console.error("[templates] export pptx failed:", err);
        toast(`「${t.scenario}」生成失败：${err?.message || "请稍后重试"}`);
      } finally {
        usePptStore.getState().setBusy(key, false);
      }
    })();
  }

  async function download(key: string, scenario: string) {
    const meta = usePptStore.getState().ready[key];
    if (!meta) return;
    const blob = await loadPptBlob(meta.idbKey);
    if (!blob) {
      // Blob 已被浏览器驱逐/清理：清掉元数据并提示重新生成
      usePptStore.getState().clearReady(key);
      toast(`「${scenario}」PPT 已失效，请重新生成`);
      return;
    }
    downloadPptxBlob(blob, meta.fileName);
  }

  // 用户保存的模板已是完整方案快照，直接生成 PPT（无需再调用 LLM）
  function generatePptForSaved(t: SavedTemplate) {
    const key = savedTemplatePptKey(t.id);
    if (usePptStore.getState().busy[key]) return;

    usePptStore.getState().setBusy(key, true);
    toast(`正在为「${t.name}」生成 PPT，请稍候…`);

    (async () => {
      try {
        const artifact = await buildProjectPptxBlob(t.project);
        const idbKey = pptIdbKey(key);
        await savePptBlob(idbKey, artifact.blob);
        usePptStore.getState().setReady(key, {
          fileName: artifact.fileName,
          createdAt: new Date().toISOString(),
          idbKey,
        });
        useNotifyStore.getState().add({
          kind: "ppt",
          title: t.name,
          message: `「${t.name}」PPT 已生成，可在模板库下载`,
        });
        toast(`「${t.name}」PPT 已生成，可以下载`, { duration: 1000 });
      } catch (err: any) {
        console.error("[templates] export pptx failed:", err);
        toast(`「${t.name}」PPT 生成失败：${err?.message || "请稍后重试"}`);
      } finally {
        usePptStore.getState().setBusy(key, false);
      }
    })();
  }

  async function removeSaved(t: SavedTemplate) {
    const key = savedTemplatePptKey(t.id);
    const meta = usePptStore.getState().ready[key];
    if (meta) {
      await deletePptBlob(meta.idbKey);
      usePptStore.getState().clearReady(key);
    }
    removeTemplate(t.id);
    toast("已从模板库移除");
  }

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-[1200px] px-6 py-10">
        <h1 className="text-xl font-semibold text-ink-900">模板库</h1>
        <p className="mt-1 text-sm text-ink-500">
          选择模板，一键生成四层架构方案并导出可用于汇报的 PPT。
        </p>

        <section className="mt-8">
          <div className="flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-brand" />
            <h2 className="text-[15px] font-semibold text-ink-900">我的模板</h2>
            <Badge>{savedTemplates.length}</Badge>
          </div>
          <p className="mt-1 text-xs text-ink-500">
            从方案页「保存模板」保存的方案，可直接选中生成 PPT。
          </p>

          {savedTemplates.length === 0 ? (
            <Card className="mt-4 flex flex-col items-center justify-center p-12 text-center">
              <FolderOpen className="mb-3 h-8 w-8 text-ink-300" />
              <p className="text-sm text-ink-500">还没有保存的模板</p>
              <p className="mt-1 text-xs text-ink-400">
                打开任意方案，点击右上角「保存模板」即可在此查看。
              </p>
            </Card>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {savedTemplates.map((t) => {
                const key = savedTemplatePptKey(t.id);
                const isBusy = !!busy[key];
                const isReady = !!ready[key];
                return (
                  <Card key={t.id} className="flex flex-col p-5 transition-all hover:border-brand/40 hover:shadow-pop">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand">
                        <BookMarked className="h-4 w-4" />
                      </div>
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => removeSaved(t)}
                      >
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
                    </div>
                    <h3 className="line-clamp-2 text-[15px] font-semibold text-ink-900">{t.name}</h3>
                    <p className="mt-1 text-xs text-ink-500">{t.industry}｜{t.scenario}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge>{t.outputPurpose}</Badge>
                      <Badge>{t.depth}</Badge>
                    </div>
                    <p className="mt-2 text-[11px] text-ink-400">保存于 {formatDate(t.savedAt)}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        disabled={isBusy}
                        onClick={() => generatePptForSaved(t)}
                      >
                        {isBusy ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> 生成中…
                          </>
                        ) : (
                          <>
                            <FileText className="h-3.5 w-3.5" /> {isReady ? "重新生成 PPT" : "生成 PPT"}
                          </>
                        )}
                      </Button>
                      {isReady && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => download(key, t.name)}
                        >
                          <Download className="h-3.5 w-3.5" /> 下载 PPT
                        </Button>
                      )}
                    </div>
                    {isBusy && (
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-500">
                        <FileText className="h-3 w-3" /> 正在构建 PPT，请稍候
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-10 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <h2 className="text-[15px] font-semibold text-ink-900">预设模板</h2>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PRESET_TEMPLATES.map((t) => {
            const key = `${t.industry}｜${t.scenario}`;
            const isBusy = !!busy[key];
            const isReady = !!ready[key];
            return (
              <Card key={key} className="flex flex-col p-5 transition-all hover:border-brand/40 hover:shadow-pop">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="text-[15px] font-semibold text-ink-900">{t.industry}｜{t.scenario}</h3>
                <p className="mt-1 line-clamp-3 text-xs text-ink-500">{t.painPoints}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge>{t.outputPurpose}</Badge>
                  <Badge>{t.depth}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    disabled={isBusy}
                    onClick={() => useTemplate(t)}
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> 生成中…
                      </>
                    ) : (
                      <>
                        <FileText className="h-3.5 w-3.5" /> {isReady ? "重新生成" : "使用模板"}
                      </>
                    )}
                  </Button>
                  {isReady && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => download(key, t.scenario)}
                    >
                      <Download className="h-3.5 w-3.5" /> 下载模板
                    </Button>
                  )}
                </div>
                {isBusy && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-500">
                    <FileText className="h-3 w-3" /> 正在生成方案并构建 PPT，约需 1–2 分钟
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
