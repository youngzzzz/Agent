"use client";
import * as React from "react";
import { createContext, useContext, useCallback, useEffect, useRef } from "react";
import { useProjectStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { useNotifyStore } from "@/lib/notify-store";
import { mockGenerateAnalysis } from "@/lib/mock-api";
import { GenerateAnalysisInput, Project } from "@/lib/types";
import { uid } from "@/lib/utils";

interface StartOptions {
  /** 已有项目 id（重新生成时传入），不传则新建 */
  projectId?: string;
  /** 项目名称，重新生成时保持原名 */
  name?: string;
  /** 创建时间，重新生成时保持原值 */
  createdAt?: string;
}

interface GenerationContextValue {
  /** 发起一个异步生成任务，立即返回项目 id（任务在后台运行） */
  startGeneration: (input: GenerateAnalysisInput, options?: StartOptions) => string;
  /** 当前是否有项目正在生成 */
  isGenerating: (projectId: string) => boolean;
}

const Ctx = createContext<GenerationContextValue>({
  startGeneration: () => "",
  isGenerating: () => false,
});

export function GenerationProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  // 正在运行的任务集合（跨页面导航保留，因为 Provider 挂在 layout 不会卸载）
  const tasksRef = useRef<Record<string, boolean>>({});

  // 应用启动时，把上次会话遗留的「生成中」项目标记为失败（其异步任务已随刷新丢失）
  useEffect(() => {
    const { projects, patchProject } = useProjectStore.getState();
    projects.forEach((p) => {
      if (p.status === "generating" && !tasksRef.current[p.id]) {
        patchProject(p.id, { status: "failed", error: "生成任务已中断，请重试" });
      }
    });
    // 仅在挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startGeneration = useCallback(
    (input: GenerateAnalysisInput, options?: StartOptions) => {
      const id = options?.projectId || uid("prj");
      const name = options?.name || `${input.industry}｜${input.scenario}`;
      const createdAt = options?.createdAt || new Date().toISOString();
      const now = new Date().toISOString();

      const { upsertProject, patchProject } = useProjectStore.getState();

      if (options?.projectId) {
        // 重新生成：保留原项目内容，仅切换为生成中
        patchProject(id, { status: "generating", error: undefined, updatedAt: now });
      } else {
        // 新建占位项目
        const placeholder: Project = {
          id,
          name,
          industry: input.industry,
          scenario: input.scenario,
          targetUser: input.targetUser,
          painPoints: input.painPoints,
          outputPurpose: input.outputPurpose,
          depth: input.depth,
          createdAt,
          updatedAt: now,
          status: "generating",
          layers: [],
        };
        upsertProject(placeholder);
      }

      tasksRef.current[id] = true;

      mockGenerateAnalysis(input)
        .then((full) => {
          const finishedAt = new Date().toISOString();
          useProjectStore.getState().upsertProject({
            ...full,
            id,
            name,
            createdAt,
            updatedAt: finishedAt,
            status: "generated",
            error: undefined,
          });
          toast(`「${name}」方案已生成完成`);
          useNotifyStore.getState().add({
            kind: "solution",
            title: name,
            message: `「${name}」方案已生成完成`,
          });
        })
        .catch((err) => {
          console.error("[generation] failed:", err);
          useProjectStore.getState().patchProject(id, {
            status: "failed",
            error: err?.message || "生成失败",
            updatedAt: new Date().toISOString(),
          });
          toast(`「${name}」方案生成失败，请重试`);
        })
        .finally(() => {
          delete tasksRef.current[id];
        });

      return id;
    },
    [toast],
  );

  const isGenerating = useCallback((projectId: string) => !!tasksRef.current[projectId], []);

  return (
    <Ctx.Provider value={{ startGeneration, isGenerating }}>{children}</Ctx.Provider>
  );
}

export function useGeneration() {
  return useContext(Ctx);
}
