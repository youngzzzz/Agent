import {
  extractJsonFromLlmText,
  isLikelyTruncatedJson,
  jsonErrorContext,
  parseLlmJson,
} from "@/lib/parse-llm-json";

export class GenerateParseError extends Error {
  constructor(
    message: string,
    readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "GenerateParseError";
  }
}

export function countProjectModules(project: any): number {
  return (project?.layers ?? []).reduce(
    (n: number, layer: any) => n + (Array.isArray(layer?.modules) ? layer.modules.length : 0),
    0,
  );
}

export function isValidGeneratedProject(project: any): boolean {
  if (!project?.layers || !Array.isArray(project.layers) || project.layers.length < 4) {
    return false;
  }
  return countProjectModules(project) >= 8;
}

export function parseGeneratedProject(text: string): any {
  // 先尝试解析（含 jsonrepair 修复），能修好就用，避免误判截断
  try {
    return parseLlmJson<any>(text);
  } catch (err: any) {
    const stripped = extractJsonFromLlmText(text);
    const truncated = isLikelyTruncatedJson(text);
    throw new GenerateParseError(
      truncated ? "LLM 输出 JSON 不完整（可能被截断）" : "LLM 输出不是合法 JSON（修复后仍失败）",
      {
        truncated,
        textPreview: stripped.slice(0, 400),
        textLen: stripped.length,
        rawLen: text.length,
        tail: text.slice(-120),
        cause: err?.message,
        // 出错位置附近的片段：生产环境也能在 Vercel 日志直接看到坏在哪一行
        errorContext: jsonErrorContext(stripped, err),
      },
    );
  }
}

export function normalizeProjectModules(project: any): void {
  for (const layer of project.layers ?? []) {
    if (!layer.modules) layer.modules = [];
    for (const mod of layer.modules) {
      if (!mod.id) mod.id = `mod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      if (!mod.layerId) mod.layerId = layer.id;
      if (mod.摘要 && !mod.summary) mod.summary = mod.摘要;
      if (mod.keyPoints && !mod.bullets) mod.bullets = mod.keyPoints;
      if (mod.points && !mod.bullets) mod.bullets = mod.points;
      if (mod.要点 && !mod.bullets) mod.bullets = mod.要点;
      if (mod.详情 && !mod.detail) mod.detail = mod.详情;
      if (mod.details && !mod.detail) mod.detail = mod.details;
      if (mod.可落地产物 && !mod.deliverables) mod.deliverables = mod.可落地产物;
      if (mod.风险 && !mod.risks) mod.risks = mod.风险;
      if (mod.建议提示词 && !mod.suggestedPrompts) mod.suggestedPrompts = mod.建议提示词;
      if (mod.标签 && !mod.tags) mod.tags = mod.标签;
      if (mod.tags && Array.isArray(mod.tags)) {
        mod.tags = mod.tags.map((t: any) =>
          typeof t === "string" ? t : t.name || t.title || JSON.stringify(t),
        );
      }
      if (!mod.bullets || !Array.isArray(mod.bullets)) mod.bullets = [];
      if (!mod.deliverables || !Array.isArray(mod.deliverables)) mod.deliverables = [];
      if (!mod.risks || !Array.isArray(mod.risks)) mod.risks = [];
      if (!mod.suggestedPrompts || !Array.isArray(mod.suggestedPrompts)) mod.suggestedPrompts = [];
    }
  }
}

export function finalizeProjectTimestamps(project: any): void {
  project.id = project.id || `proj_${Date.now()}`;
  const cstNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const cstISO = cstNow.toISOString().replace("T", " ").slice(0, 19) + "+08:00";
  project.createdAt = cstISO;
  project.updatedAt = cstISO;
  project.status = "generated";
}
