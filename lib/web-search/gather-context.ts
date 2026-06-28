import { getLLMConfig } from "@/lib/llm-config";
import { GenerateAnalysisInput } from "@/lib/types";
import { executeWebSearch } from "@/lib/web-search/execute";
import { isWebSearchEnabled } from "@/lib/web-search/config";
import { resolveWebSearchStrategy, strategyLabel } from "@/lib/web-search/strategy";

/** 方案生成前预检索：并行搜索，避免 Tool Loop 导致超时/截断 */
export async function gatherSearchContextForGenerate(
  input: GenerateAnalysisInput,
): Promise<{ context: string; used: boolean; strategy: string }> {
  if (!isWebSearchEnabled()) {
    return { context: "", used: false, strategy: "disabled" };
  }

  const cfg = getLLMConfig();
  const strategy = resolveWebSearchStrategy(cfg);
  if (strategy === "disabled") {
    return { context: "", used: false, strategy: "disabled" };
  }

  const queries = [
    `${input.industry} ${input.scenario} AI 应用 市场趋势 2025`,
    `${input.industry} ${input.scenario} 竞品 产品案例`,
  ];

  console.info(`[web-search] prefetch strategy=${strategyLabel(strategy)} queries=${queries.length}`);

  const results = await Promise.allSettled(
    queries.map((q) => executeWebSearch(q, strategy)),
  );

  const isUsableResult = (v: string) =>
    !!v &&
    !v.startsWith("搜索失败") &&
    !v.startsWith("当前策略") &&
    v !== "搜索词为空。" &&
    v !== "未找到相关结果。";

  const blocks: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled" && isUsableResult(r.value)) {
      blocks.push(`### 检索 ${i + 1}：${queries[i]}\n${r.value}`);
    }
  }

  const context = blocks.join("\n\n");
  return {
    context,
    used: blocks.length > 0,
    strategy: strategyLabel(strategy),
  };
}
