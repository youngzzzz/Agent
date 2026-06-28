/**
 * 生成任务存储 —— 支持「刷新页面不中断生成」。
 *
 * 后台生成把结果写入这里，前端凭 jobId 轮询；刷新后用持久化的 jobId 续轮即可恢复。
 *
 * 存储后端：
 *   - 线上（Vercel 多实例）：Upstash Redis（配置了 REST URL/TOKEN 时自动启用）
 *   - 本地 / 未配置：进程内存 Map（next dev 单进程，刷新浏览器仍可命中，足以本地验证）
 *
 * 兼容多种环境变量命名：
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  （Upstash 原生）
 *   KV_REST_API_URL / KV_REST_API_TOKEN                （Vercel KV / Marketplace 集成）
 */
import { Redis } from "@upstash/redis";
import type { Project } from "./types";

export type JobStatus = "pending" | "done" | "failed";

export interface JobRecord {
  status: JobStatus;
  project?: Project;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

// 任务结果保留时长（秒）：1 小时足够前端取回，过期自动清理
const JOB_TTL_SECONDS = 60 * 60;
const KEY_PREFIX = "genjob:";

function resolveRedis(): Redis | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = resolveRedis();

/** 是否启用了持久化存储（线上多实例必须为 true 才能保证刷新恢复可靠） */
export function isJobStoreDurable(): boolean {
  return redis !== null;
}

// 内存兜底：用 globalThis 挂载，避免 dev 模式 HMR 重新加载模块时丢失
const memStore: Map<string, JobRecord> = (() => {
  const g = globalThis as unknown as { __genJobStore?: Map<string, JobRecord> };
  if (!g.__genJobStore) g.__genJobStore = new Map();
  return g.__genJobStore;
})();

export async function createJob(id: string): Promise<void> {
  const now = new Date().toISOString();
  const rec: JobRecord = { status: "pending", createdAt: now, updatedAt: now };
  await writeJob(id, rec);
}

export async function setJobResult(id: string, project: Project): Promise<void> {
  const now = new Date().toISOString();
  const prev = await getJob(id);
  await writeJob(id, {
    status: "done",
    project,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function setJobError(id: string, error: string): Promise<void> {
  const now = new Date().toISOString();
  const prev = await getJob(id);
  await writeJob(id, {
    status: "failed",
    error,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function getJob(id: string): Promise<JobRecord | null> {
  if (redis) {
    const v = await redis.get<JobRecord>(KEY_PREFIX + id);
    return v ?? null;
  }
  return memStore.get(id) ?? null;
}

async function writeJob(id: string, rec: JobRecord): Promise<void> {
  if (redis) {
    await redis.set(KEY_PREFIX + id, rec, { ex: JOB_TTL_SECONDS });
    return;
  }
  memStore.set(id, rec);
  // 内存兜底也做一个简单的过期清理，避免长期运行内存膨胀
  const cutoff = Date.now() - JOB_TTL_SECONDS * 1000;
  for (const [k, v] of memStore) {
    if (new Date(v.updatedAt).getTime() < cutoff) memStore.delete(k);
  }
}
