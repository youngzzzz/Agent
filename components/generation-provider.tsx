"use client";
import * as React from "react";
import { createContext, useContext, useCallback, useEffect, useRef } from "react";
import { useProjectStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { useNotifyStore } from "@/lib/notify-store";
import { startGenerateJob, fetchGenerateJobStatus } from "@/lib/mock-api";
import { GenerateAnalysisInput, Project } from "@/lib/types";
import { uid } from "@/lib/utils";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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
  // 正在轮询的任务集合（跨页面导航保留，因为 Provider 挂在 layout 不会卸载）
  const tasksRef = useRef<Record<string, boolean>>({});

  // 轮询某个项目的后台生成任务，直到完成 / 失败 / 过期。
  // 通过持久化在 project.jobId 上的任务 id 续轮，因此刷新页面也能恢复进度。
  const pollJob = useCallback(
    (projectId: string, jobId: string, name: string, opts?: { silent?: boolean }) => {
      if (tasksRef.current[projectId]) return; // 已在轮询，避免重复
      tasksRef.current[projectId] = true;

      (async () => {
        const start = Date.now();
        try {
          while (true) {
            const s = await fetchGenerateJobStatus(jobId);

            if (s.status === "done" && s.project) {
              const finishedAt = new Date().toISOString();
              const prev = useProjectStore.getState().getProject(projectId);
              useProjectStore.getState().upsertProject({
                ...s.project,
                id: projectId,
                name: prev?.name || name,
                createdAt: prev?.createdAt || finishedAt,
                updatedAt: finishedAt,
                status: "generated",
                error: undefined,
                jobId: undefined,
              });
              if (!opts?.silent) {
                toast(`「${name}」方案已生成完成`);
              }
              useNotifyStore.getState().add({
                kind: "solution",
                title: name,
                message: `「${name}」方案已生成完成`,
              });
              return;
            }

            if (s.status === "failed" || s.status === "expired") {
              const msg =
                s.status === "expired"
                  ? "生成任务已过期，请重新生成"
                  : s.error || "生成失败";
              useProjectStore.getState().patchProject(projectId, {
                status: "failed",
                error: msg,
                jobId: undefined,
                updatedAt: new Date().toISOString(),
              });
              if (!opts?.silent) toast(`「${name}」方案生成失败，请重试`);
              return;
            }

            if (Date.now() - start > POLL_TIMEOUT_MS) {
              useProjectStore.getState().patchProject(projectId, {
                status: "failed",
                error: "生成超时，请重试",
                jobId: undefined,
                updatedAt: new Date().toISOString(),
              });
              if (!opts?.silent) toast(`「${name}」方案生成超时，请重试`);
              return;
            }

            await delay(POLL_INTERVAL_MS);
          }
        } catch (err: any) {
          console.error("[generation] poll failed:", err);
          useProjectStore.getState().patchProject(projectId, {
            status: "failed",
            error: err?.message || "生成失败",
            jobId: undefined,
            updatedAt: new Date().toISOString(),
          });
          if (!opts?.silent) toast(`「${name}」方案生成失败，请重试`);
        } finally {
          delete tasksRef.current[projectId];
        }
      })();
    },
    [toast],
  );

  // 应用启动时：对仍处于「生成中」的项目，凭已持久化的 jobId 续轮恢复进度；
  // 没有 jobId 的（旧数据 / 启动任务前就刷新了）才标记为失败。
  useEffect(() => {
    const { projects, patchProject } = useProjectStore.getState();
    projects.forEach((p) => {
      if (p.status !== "generating" || tasksRef.current[p.id]) return;
      if (p.jobId) {
        pollJob(p.id, p.jobId, p.name, { silent: true });
      } else {
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
        patchProject(id, { status: "generating", error: undefined, jobId: undefined, updatedAt: now });
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

      // 启动后台任务：拿到 jobId 后持久化到项目上，再开始轮询。
      // 这样即便随后刷新页面，挂载时也能凭 jobId 续轮恢复。
      startGenerateJob(input)
        .then((jobId) => {
          useProjectStore.getState().patchProject(id, { jobId });
          pollJob(id, jobId, name);
        })
        .catch((err) => {
          console.error("[generation] start failed:", err);
          useProjectStore.getState().patchProject(id, {
            status: "failed",
            error: err?.message || "启动生成失败",
            updatedAt: new Date().toISOString(),
          });
          toast(`「${name}」方案启动失败，请重试`);
        });

      return id;
    },
    [toast, pollJob],
  );

  const isGenerating = useCallback((projectId: string) => !!tasksRef.current[projectId], []);

  return (
    <Ctx.Provider value={{ startGeneration, isGenerating }}>{children}</Ctx.Provider>
  );
}

export function useGeneration() {
  return useContext(Ctx);
}
