"use client";
/**
 * PPT Blob 的 IndexedDB 持久化（基于 idb-keyval）。
 *
 * 设计：
 *   - 只把体积较大的 Blob 存 IndexedDB；轻量元数据（文件名等）由 zustand persist 存 localStorage。
 *   - 键固定为 `ppt:${模板key}`，模板集合是有限预设，重新生成会覆盖同一键，天然不膨胀，无需 LRU。
 *   - 所有方法都做了 SSR / 无 IndexedDB 环境守卫，失败只告警不抛出，避免影响主流程。
 */
import { get, set, del } from "idb-keyval";

function idbAvailable(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

export function pptIdbKey(templateKey: string): string {
  return `ppt:${templateKey}`;
}

export async function savePptBlob(idbKey: string, blob: Blob): Promise<void> {
  if (!idbAvailable()) return;
  try {
    await set(idbKey, blob);
  } catch (err) {
    console.warn("[ppt-storage] save failed:", err);
  }
}

export async function loadPptBlob(idbKey: string): Promise<Blob | undefined> {
  if (!idbAvailable()) return undefined;
  try {
    const v = await get<Blob>(idbKey);
    return v instanceof Blob ? v : undefined;
  } catch (err) {
    console.warn("[ppt-storage] load failed:", err);
    return undefined;
  }
}

export async function deletePptBlob(idbKey: string): Promise<void> {
  if (!idbAvailable()) return;
  try {
    await del(idbKey);
  } catch (err) {
    console.warn("[ppt-storage] delete failed:", err);
  }
}

/** 申请持久化存储，降低被浏览器自动驱逐的概率（用户可能弹窗授权）。只需调用一次。 */
export async function requestPersistentStorage(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return;
  try {
    const already = (await navigator.storage.persisted?.()) ?? false;
    if (!already) await navigator.storage.persist();
  } catch {
    /* 忽略：拿不到持久化授权不影响功能 */
  }
}
