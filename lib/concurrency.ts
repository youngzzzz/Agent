/**
 * 全局 LLM 并发闸 + 限流（进程内计数）。
 *
 * 作用：保护后端与 LLM 供应商，避免瞬时高并发把 API 打爆或刷高账单。
 *
 * 策略：
 *   - 全局并发：同时在途的 LLM 请求不超过 LLM_MAX_CONCURRENCY（默认 30）
 *   - 排队：超出并发上限的请求进入等待队列，队列上限 LLM_MAX_QUEUE（默认 50）
 *   - 超时：在队列中等待超过 LLM_QUEUE_TIMEOUT_MS（默认 60s）直接拒绝
 *   - 单 IP 并发：同一 IP 同时在途请求不超过 LLM_MAX_PER_IP（默认 4，设 0 关闭）
 *
 * ⚠️ 状态保存在进程内存：
 *   - 单机部署（next start / PM2 单进程）= 真正的全局闸。
 *   - Vercel 等多实例 Serverless = 每个实例各算各的（实际上限 ≈ 配置值 × 实例数）。
 *     如需严格全局限流，应改用外置 Redis（如 Upstash）计数，可后续扩展。
 */

function intEnv(name: string, dflt: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return dflt;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : dflt;
}

const maxConcurrency = () => intEnv("LLM_MAX_CONCURRENCY", 30);
const maxQueue = () => intEnv("LLM_MAX_QUEUE", 50);
const queueTimeoutMs = () => intEnv("LLM_QUEUE_TIMEOUT_MS", 60_000);
const maxPerIp = () => intEnv("LLM_MAX_PER_IP", 4);

/** 过载错误：路由据此返回 503/429，而不是当成普通 500。 */
export class OverloadedError extends Error {
  status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.name = "OverloadedError";
    this.status = status;
  }
}

interface Waiter {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

let active = 0;
const queue: Waiter[] = [];
const perIp = new Map<string, number>();

/** 全局槽位释放后，唤醒队首等待者。 */
function pump() {
  if (active >= maxConcurrency()) return;
  const w = queue.shift();
  if (!w) return;
  clearTimeout(w.timer);
  active++;
  w.resolve();
}

/**
 * 申请一个 LLM 执行槽位。
 * - 成功：返回 release()，调用方必须在 finally 中调用（幂等，重复调用安全）。
 * - 拥塞：抛出 OverloadedError（单 IP 超限 → 429；全局队列满/超时 → 503）。
 */
export async function acquireLlmSlot(ip?: string): Promise<() => void> {
  const ipKey = ip && ip.trim() ? ip.trim() : "";
  const perIpLimit = maxPerIp();
  const ipLimited = ipKey !== "" && perIpLimit > 0;

  if (ipLimited) {
    const cur = perIp.get(ipKey) ?? 0;
    if (cur >= perIpLimit) {
      throw new OverloadedError("您的请求过于频繁，请稍后再试", 429);
    }
    perIp.set(ipKey, cur + 1);
  }

  const releasePerIp = () => {
    if (!ipLimited) return;
    const cur = perIp.get(ipKey) ?? 0;
    if (cur <= 1) perIp.delete(ipKey);
    else perIp.set(ipKey, cur - 1);
  };

  try {
    await new Promise<void>((resolve, reject) => {
      if (active < maxConcurrency()) {
        active++;
        resolve();
        return;
      }
      if (queue.length >= maxQueue()) {
        reject(new OverloadedError("服务繁忙，请稍后再试", 503));
        return;
      }
      const waiter: Waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const idx = queue.indexOf(waiter);
          if (idx >= 0) queue.splice(idx, 1);
          reject(new OverloadedError("排队超时，请稍后再试", 503));
        }, queueTimeoutMs()),
      };
      queue.push(waiter);
    });
  } catch (err) {
    releasePerIp();
    throw err;
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    active = Math.max(0, active - 1);
    releasePerIp();
    pump();
  };
}

/** 当前闸门状态，便于日志/监控。 */
export function getGateStats() {
  return {
    active,
    queued: queue.length,
    trackedIps: perIp.size,
    maxConcurrency: maxConcurrency(),
    maxQueue: maxQueue(),
  };
}

/** 从请求头解析客户端 IP（兼容 Nginx / Vercel 代理链）。 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    ""
  );
}
