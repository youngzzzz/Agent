"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/* ------------------------------------------------------------------ *
 * 提醒（通知）store —— 内存态，不持久化。
 * 方案生成 / PPT 生成等任务完成后写入一条，并累加未读计数；
 * 顶部铃铛点击查看后清空未读计数。
 * ------------------------------------------------------------------ */
export type NotifyKind = "solution" | "ppt";

export interface NotifyItem {
  id: string;
  kind: NotifyKind;
  title: string;
  message: string;
  createdAt: string;
}

interface NotifyStore {
  items: NotifyItem[];
  unread: number;
  add: (n: { kind: NotifyKind; title: string; message: string }) => void;
  clearUnread: () => void;
  clearAll: () => void;
}

export const useNotifyStore = create<NotifyStore>((set) => ({
  items: [],
  unread: 0,
  add: (n) =>
    set((s) => ({
      items: [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: new Date().toISOString(),
          ...n,
        },
        ...s.items,
      ].slice(0, 50),
      unread: s.unread + 1,
    })),
  clearUnread: () => set({ unread: 0 }),
  clearAll: () => set({ items: [], unread: 0 }),
}));

/* ------------------------------------------------------------------ *
 * PPT 任务 store
 *   busy[key]：该模板是否正在生成（内存态，刷新即重置；不持久化）
 *   ready[key]：该模板已生成 PPT 的「元数据」（持久化到 localStorage）
 *               真正的 Blob 存 IndexedDB（见 lib/ppt-storage.ts），按 idbKey 取用。
 * ------------------------------------------------------------------ */
export interface PptReadyMeta {
  fileName: string;
  createdAt: string;
  /** IndexedDB 中存放 Blob 的键 */
  idbKey: string;
}

interface PptStore {
  busy: Record<string, boolean>;
  ready: Record<string, PptReadyMeta>;
  setBusy: (key: string, value: boolean) => void;
  setReady: (key: string, meta: PptReadyMeta) => void;
  clearReady: (key: string) => void;
}

export const usePptStore = create<PptStore>()(
  persist(
    (set) => ({
      busy: {},
      ready: {},
      setBusy: (key, value) =>
        set((s) => ({ busy: { ...s.busy, [key]: value } })),
      setReady: (key, meta) =>
        set((s) => ({ ready: { ...s.ready, [key]: meta } })),
      clearReady: (key) =>
        set((s) => {
          const next = { ...s.ready };
          delete next[key];
          return { ready: next };
        }),
    }),
    {
      name: "ppt-store-v1",
      storage: createJSONStorage(() => localStorage),
      // 只持久化 ready 元数据；busy 是瞬时状态，刷新后必须归零
      partialize: (s) => ({ ready: s.ready }),
    },
  ),
);
