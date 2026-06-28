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
  // 1) 严格解析
  try {
    return JSON.parse(stripped) as T;
  } catch (strictErr) {
    // 2) jsonrepair（缺逗号、尾逗号、未转义引号等）
    try {
      return JSON.parse(jsonrepair(stripped)) as T;
    } catch {
      // 3) 先归一化「字符串外」的全角结构标点（全角冒号/逗号/括号），再 jsonrepair
      try {
        return JSON.parse(jsonrepair(sanitizeJsonStructure(stripped))) as T;
      } catch {
        // 仍失败：抛出原始严格解析错误，便于定位真实位置
        throw strictErr;
      }
    }
  }
}
