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
  try {
    return JSON.parse(stripped) as T;
  } catch (strictErr) {
    try {
      const repaired = jsonrepair(stripped);
      return JSON.parse(repaired) as T;
    } catch {
      // 抛出原始严格解析错误，便于定位真实位置
      throw strictErr;
    }
  }
}
