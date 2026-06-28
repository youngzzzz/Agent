import { jsonrepair } from "jsonrepair";

/**
 * 从 LLM 回复中提取 JSON 对象文本。
 * 兼容：前言说明、markdown code fence、前后多余文字。
 */
export function extractJsonFromLlmText(text: string): string {
  let s = text.replace(/```json\s*|```\s*/gi, "").trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) {
    s = s.slice(first, last + 1);
  }
  return s;
}

/**
 * 仅在「字符串外部」把全角结构标点归一化为半角。
 * 解决 LLM 把结构性冒号/逗号/括号误打成全角（如 "title"："业务层"）导致的解析失败。
 * 关键：字符串内部的中文标点（detail 长文本里的「：、，」）保持不动，避免破坏正文。
 */
export function sanitizeJsonStructure(s: string): string {
  const map: Record<string, string> = {
    "：": ":",
    "，": ",",
    "｛": "{",
    "｝": "}",
    "［": "[",
    "］": "]",
  };
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      out += ch;
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    out += map[ch] ?? ch;
  }
  return out;
}

/**
 * 修复「数组/对象被双引号包裹」的畸形，如：
 *   "suggestedPrompts":"["a","b"]"   →   "suggestedPrompts":["a","b"]
 * 仅当容器符号（[ 或 {）紧跟在 :" 之后时才处理——正常中文字符串值不会以 [ / { 开头，
 * 因此不会误伤正文（如 detail 里出现的 [1] 等）。作为最后一道修复使用。
 */
export function repairQuoteWrappedContainers(s: string): string {
  return s
    .replace(/:\s*"(\[[\s\S]*?\])"/g, ":$1")
    .replace(/:\s*"(\{[\s\S]*?\})"/g, ":$1");
}

/** 从原生 JSON 解析错误信息里提取 position，并返回出错位置附近的上下文片段，便于日志定位。 */
export function jsonErrorContext(text: string, err: unknown): string | undefined {
  const msg = err instanceof Error ? err.message : String(err);
  const m = /position\s+(\d+)/i.exec(msg);
  if (!m) return undefined;
  const pos = Number(m[1]);
  if (!Number.isFinite(pos)) return undefined;
  const from = Math.max(0, pos - 80);
  const to = Math.min(text.length, pos + 80);
  const snippet = text.slice(from, to).replace(/\n/g, "\\n");
  return `…${snippet}…  (↑ around position ${pos})`;
}

export function isLikelyTruncatedJson(text: string): boolean {
  const s = extractJsonFromLlmText(text).trim();
  if (!s.startsWith("{")) return true;
  if (!s.endsWith("}")) return true;
  // 括号不匹配通常表示被截断
  let depth = 0;
  let inString = false;
  let escape = false;
  for (const ch of s) {
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") depth--;
  }
  return depth !== 0;
}

/**
 * 解析 LLM 返回的 JSON。
 * 先严格解析；失败则用 jsonrepair 修复常见错误（未转义引号、缺逗号、尾逗号等）后再解析。
 */
export function parseLlmJson<T = unknown>(text: string): T {
  const stripped = extractJsonFromLlmText(text);
  // 逐级尝试：严格 → jsonrepair → 归一化全角结构标点 → 修复被引号包裹的数组/对象。
  // 越往后越激进，保留第一个（最贴近真实位置的）错误用于上抛。
  const candidates: Array<() => unknown> = [
    () => JSON.parse(stripped),
    () => JSON.parse(jsonrepair(stripped)),
    () => JSON.parse(jsonrepair(sanitizeJsonStructure(stripped))),
    () =>
      JSON.parse(
        jsonrepair(repairQuoteWrappedContainers(sanitizeJsonStructure(stripped))),
      ),
  ];

  let firstErr: unknown;
  for (const attempt of candidates) {
    try {
      return attempt() as T;
    } catch (err) {
      if (firstErr === undefined) firstErr = err;
    }
  }
  throw firstErr;
}
