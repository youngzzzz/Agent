import { promises as fs } from "fs";
import path from "path";

/**
 * 是否开启生成调试转存。
 * 默认：非生产环境自动开启；可用 LLM_DEBUG_DUMP=false 强制关闭。
 */
export function isDebugDumpEnabled(): boolean {
  if (process.env.LLM_DEBUG_DUMP === "false") return false;
  if (process.env.LLM_DEBUG_DUMP === "true") return true;
  return process.env.NODE_ENV !== "production";
}

export interface GenerateDebugRecord {
  at: string;
  input: unknown;
  strategy: string;
  nativeToolLoop: boolean;
  webSearchUsed: boolean;
  model?: string;
  baseURL?: string;
  systemPrompt: string;
  userPrompt: string;
  searchContext?: string;
  rawResponse: string;
  parsedOk: boolean;
  parseError?: string;
}

/** 把一次生成的完整 prompt + 原始响应写到 debug/ 目录，返回文件路径 */
export async function dumpGenerateDebug(
  record: GenerateDebugRecord,
): Promise<string | null> {
  if (!isDebugDumpEnabled()) return null;

  try {
    const dir = path.join(process.cwd(), "debug");
    await fs.mkdir(dir, { recursive: true });

    const ts = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const safeName =
      (record.input as any)?.scenario?.toString().slice(0, 20).replace(/[\\/:*?"<>|\s]/g, "_") ||
      "generate";
    const file = path.join(dir, `generate-${ts}-${safeName}.json`);

    await fs.writeFile(file, JSON.stringify(record, null, 2), "utf-8");
    console.info(`[generate] debug dump written: ${file}`);
    return file;
  } catch (err: any) {
    console.warn("[generate] debug dump failed:", err?.message);
    return null;
  }
}
