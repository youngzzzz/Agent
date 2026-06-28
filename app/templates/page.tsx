"use client";
import { useEffect } from "react";
import { TopNav } from "@/components/top-nav";
import { Card, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { PRESET_TEMPLATES } from "@/lib/mock-data";
import { mockGenerateAnalysis } from "@/lib/mock-api";
import { buildProjectPptxBlob, downloadPptxBlob } from "@/lib/ppt-export";
import {
  loadPptBlob,
  pptIdbKey,
  requestPersistentStorage,
  savePptBlob,
} from "@/lib/ppt-storage";
import { useProjectStore } from "@/lib/store";
import { usePptStore, useNotifyStore } from "@/lib/notify-store";
import { useToast } from "@/components/ui/toast";
import { GenerateAnalysisInput } from "@/lib/types";
import { Sparkles, Download, Loader2, FileText } from "lucide-react";

export default function TemplatesPage() {
  const upsert = useProjectStore((s) => s.upsertProject);
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

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-[1200px] px-6 py-10">
        <h1 className="text-xl font-semibold text-ink-900">模板库</h1>
        <p className="mt-1 text-sm text-ink-500">
          选择模板，一键生成四层架构方案并导出可用于汇报的 PPT。
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
