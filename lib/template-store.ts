"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { SavedTemplate } from "./types";

/* ------------------------------------------------------------------ *
 * 模板库 store —— 持久化到 localStorage。
 * 方案页点击「保存模板」时，把当前方案快照写入这里；
 * 模板库页面读取并渲染「我的模板」，可选中生成/下载 PPT。
 * ------------------------------------------------------------------ */
interface TemplateStore {
  templates: SavedTemplate[];
  addTemplate: (t: SavedTemplate) => void;
  removeTemplate: (id: string) => void;
}

export const useTemplateStore = create<TemplateStore>()(
  persist(
    (set) => ({
      templates: [],
      addTemplate: (t) =>
        set((s) => {
          // 同一来源方案重复保存时，覆盖更新并置顶
          const rest = s.templates.filter(
            (x) => x.sourceProjectId !== t.sourceProjectId,
          );
          return { templates: [t, ...rest] };
        }),
      removeTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((x) => x.id !== id) })),
    }),
    {
      name: "ai-canvas-templates-v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** 用户模板在 PPT store 中使用的键，避免与预设模板的「行业｜场景」键冲突 */
export function savedTemplatePptKey(templateId: string): string {
  return `tpl:${templateId}`;
}
