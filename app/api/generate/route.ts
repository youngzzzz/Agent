import { NextRequest, NextResponse } from "next/server";
import { chatCompletionStream } from "@/lib/llm";
import { getLLMConfig } from "@/lib/llm-config";
import {
  chatCompletionWithWebSearch,
  WEB_SEARCH_SYSTEM_APPEND,
} from "@/lib/llm-agent";
import {
  finalizeProjectTimestamps,
  GenerateParseError,
  isValidGeneratedProject,
  normalizeProjectModules,
  parseGeneratedProject,
} from "@/lib/generate-project";
import { isWebSearchEnabled, resolveWebSearchStrategy } from "@/lib/web-search";
import { gatherSearchContextForGenerate } from "@/lib/web-search/gather-context";
import { dumpGenerateDebug } from "@/lib/debug-dump";
import { runLlmWithFallback } from "@/lib/llm-fallback";
import { acquireLlmSlot, getClientIp, OverloadedError } from "@/lib/concurrency";
import { createJob, setJobError, setJobResult } from "@/lib/job-store";
import { GenerateAnalysisInput } from "@/lib/types";
import { uid } from "@/lib/utils";
import { waitUntil } from "@vercel/functions";

// 强制 Node 运行时（需要 process.env / 服务端 fetch），并放宽函数最大执行时长。
// 深度方案会等待完整 LLM 响应，默认超时会被中断导致前端 "Failed to fetch"。
// 300s 在 Vercel Hobby / Pro（Fluid Compute）均可用，超出会被自动截断而非构建失败。
export const runtime = "nodejs";
export const maxDuration = 300;

/** 按方案深度返回内容详尽度要求 + 输出上限 */
function getDepthSpec(depth: string): {
  limits: string;
  maxTokens: number;
} {
  const isDeep = /深度|deep|pro|高级|详细/i.test(depth);

  if (isDeep) {
    return {
      maxTokens: 48000,
      limits: `
内容详尽度要求（深度版，请写满写透，避免空泛）：
- 共 4 层（business / ai / product / delivery），每层 5～6 个模块
- 每个模块：
  - summary：60～90 字，点明该模块的核心结论
  - detail：220～360 字，用结构化 Markdown 组织（这是一个 JSON 字符串字段）：
    · 至少分 2～3 个自然段，段与段之间用换行分隔（在 JSON 中写成 \\n）
    · 适当使用「#### 小标题」「- 要点列表」，对比/分级信息可用 Markdown 表格
    · 内容要有具体做法、数据/指标、关键决策依据，结合行业实际，不要套话
  - bullets：4～6 条，每条是可执行的具体动作或判断
  - deliverables：2～3 条具体产物（文档/原型/模型/流程）
  - risks：2～3 条真实风险及简要应对
  - suggestedPrompts：1～2 条可直接复用的提示词
- painPoints 用字符串（分号分隔），不要用数组
- 务必输出完整闭合的 JSON：第一个字符是 {，最后一个字符是 }`,
    };
  }

  return {
    maxTokens: 32000,
    limits: `
内容详尽度要求（标准版）：
- 共 4 层（business / ai / product / delivery），每层 4～5 个模块
- 每个模块：
  - summary：40～60 字
  - detail：140～220 字，用结构化 Markdown 组织（这是一个 JSON 字符串字段）：
    · 至少分 2 个自然段，段与段之间用换行分隔（在 JSON 中写成 \\n）
    · 可用「- 要点列表」突出关键判断，给出具体做法，避免空泛套话
  - bullets：3～5 条具体要点
  - deliverables：2 条、risks：2 条、suggestedPrompts：1～2 条
- painPoints 用字符串（分号分隔），不要用数组
- 务必输出完整闭合的 JSON：第一个字符是 {，最后一个字符是 }`,
  };
}

function buildSystemPrompt(depth: string, withNativeSearch: boolean): string {
  const { limits } = getDepthSpec(depth);
  let prompt = `你是 AI 转型咨询专家，擅长将任意行业场景拆解为一套可落地、可执行的 AI 产品方案。
请严格按照四层结构输出：业务层(business)、AI应用层(ai)、产品层(product)、交付层(delivery)。
每个模块需要包含：title、summary、bullets、detail、deliverables、risks、suggestedPrompts。
直接输出合法的 JSON 对象，不要任何前言、后语或 Markdown 代码块。
JSON 合法性要求（重要）：字符串值内部如需引号，一律使用中文引号「」或""，禁止使用英文半角双引号 "，避免破坏 JSON；字符串内部如需换行（如 detail 字段的分段），必须写成转义的 \\n，不要直接输出真实换行符。
结构符号必须用半角：键值之间的冒号、元素之间的逗号、对象 {} 与数组 [] 一律使用半角符号（: , { } [ ]），绝对不要写成全角（： ， ｛ ｝ ［ ］）。全角标点只允许出现在字符串值的中文正文里。
${limits}
结构如下：
{
  "id": "项目ID",
  "name": "项目名称",
  "industry": "行业",
  "scenario": "场景",
  "targetUser": "目标用户",
  "painPoints": "痛点",
  "outputPurpose": "输出目的",
  "depth": "深度",
  "createdAt": "ISO时间",
  "updatedAt": "ISO时间",
  "status": "generated",
  "layers": [
    { "id": "business", "name": "business", "title": "业务层", "description": "业务层定义", "modules": [] },
    { "id": "ai", "name": "ai", "title": "AI应用层", "description": "AI应用层定义", "modules": [] },
    { "id": "product", "name": "product", "title": "产品层", "description": "产品层定义", "modules": [] },
    { "id": "delivery", "name": "delivery", "title": "交付层", "description": "交付层定义", "modules": [] }
  ]
}`;

  if (withNativeSearch) {
    prompt += WEB_SEARCH_SYSTEM_APPEND;
  }
  return prompt;
}

const RETRY_HINT = `
【重要】上次输出不完整或被截断。请适度精简表述（detail 控制在要求下限附近），但保持四层结构与模块数量完整，务必输出完整闭合的 JSON。`;

function buildUserPrompt(
  input: GenerateAnalysisInput,
  searchContext: string,
  retry: boolean,
): string {
  let prompt = `行业：${input.industry}
场景：${input.scenario}
${input.targetUser ? `目标用户：${input.targetUser}` : ""}
${input.painPoints ? `痛点：${input.painPoints}` : ""}
输出目的：${input.outputPurpose}
深度：${input.depth}`;

  if (searchContext) {
    prompt += `\n\n【互联网检索参考（请融入方案，结合最新信息，勿照搬原文）】\n${searchContext}`;
  }
  if (retry) prompt += RETRY_HINT;
  return prompt;
}

/** 执行一次完整生成，成功返回 project，失败抛出 GenerateParseError。 */
async function runGeneration(input: GenerateAnalysisInput): Promise<any> {
  const { maxTokens } = getDepthSpec(input.depth);

  const webEnabled = isWebSearchEnabled();
  const strategy = webEnabled ? resolveWebSearchStrategy(getLLMConfig()) : "disabled";
  // DeepSeek 原生 web_search 走 Tool Loop；其余（MiniMax / 第三方）走预检索
  const useNativeToolLoop = strategy === "deepseek-anthropic-native";

  let searchContext = "";
  let webSearchUsed = false;

  if (webEnabled && !useNativeToolLoop) {
    const search = await gatherSearchContextForGenerate(input);
    searchContext = search.context;
    webSearchUsed = search.used;
  }

  const systemPrompt = buildSystemPrompt(input.depth, useNativeToolLoop);
  const cfg = getLLMConfig();

  let project: any;
  let lastError: GenerateParseError | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const llmStart = Date.now();
    const userPrompt = buildUserPrompt(input, searchContext, attempt > 0);
    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt },
    ];

    let text: string;
    if (useNativeToolLoop) {
      const r = await runLlmWithFallback((c) =>
        chatCompletionWithWebSearch(messages, { max_tokens: maxTokens }, c),
      );
      text = r.text;
      webSearchUsed = r.webSearchUsed;
    } else {
      text = await runLlmWithFallback((c) =>
        chatCompletionStream(messages, { max_tokens: maxTokens }, () => {}, c),
      );
    }

    const llmMs = Date.now() - llmStart;
    console.info(
      `[generate] attempt=${attempt + 1} LLM ${llmMs}ms strategy=${strategy} nativeLoop=${useNativeToolLoop} webSearch=${webSearchUsed} len=${text.length}`,
    );

    let parsedOk = false;
    let parseErrMsg: string | undefined;
    try {
      project = parseGeneratedProject(text);
      normalizeProjectModules(project);
      if (!isValidGeneratedProject(project)) {
        throw new GenerateParseError("方案结构不完整（layers 为空或模块过少）", {
          moduleCount: (project?.layers ?? []).reduce(
            (n: number, l: any) => n + (l.modules?.length ?? 0),
            0,
          ),
        });
      }
      parsedOk = true;
      lastError = null;
    } catch (err) {
      lastError =
        err instanceof GenerateParseError ? err : new GenerateParseError(String(err));
      parseErrMsg = lastError.message;
      console.warn(
        `[generate] attempt ${attempt + 1} failed:`,
        lastError.message,
        lastError.meta,
      );
    }

    await dumpGenerateDebug({
      at: new Date().toISOString(),
      input,
      strategy,
      nativeToolLoop: useNativeToolLoop,
      webSearchUsed,
      model: cfg.model,
      baseURL: cfg.baseURL + cfg.path,
      systemPrompt,
      userPrompt,
      searchContext: searchContext || undefined,
      rawResponse: text,
      parsedOk,
      parseError: parseErrMsg,
    });

    if (parsedOk) break;
  }

  if (lastError || !project) {
    throw lastError || new GenerateParseError("方案生成失败，请重试");
  }

  finalizeProjectTimestamps(project);

  const moduleCount = project.layers.reduce(
    (n: number, l: any) => n + l.modules.length,
    0,
  );
  console.info(
    `[generate] parsed strategy=${strategy} webSearch=${webSearchUsed} modules=${moduleCount}`,
  );
  return project;
}

/**
 * 后台任务模式：POST 立即返回 jobId，生成在 waitUntil 后台继续并把结果落库。
 * 前端凭 jobId 轮询 /api/generate/status；刷新页面后用持久化的 jobId 续轮即可恢复，
 * 不会因为页面刷新而中断生成。
 */
export async function POST(req: NextRequest) {
  let input: GenerateAnalysisInput;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体解析失败" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const jobId = uid("job");
  await createJob(jobId);

  // 后台执行：并发闸 → 生成 → 落库。过载/失败都写入任务状态，由前端轮询读取。
  const task = (async () => {
    const start = Date.now();
    let release: (() => void) | null = null;
    try {
      release = await acquireLlmSlot(ip);
      const project = await runGeneration(input);
      await setJobResult(jobId, project);
      console.info(
        `[generate] job ${jobId} success total ${Date.now() - start}ms modules=${project.layers.reduce(
          (n: number, l: any) => n + l.modules.length,
          0,
        )}`,
      );
    } catch (err: any) {
      const msg =
        err instanceof OverloadedError
          ? err.message
          : err?.message || "生成失败";
      console.error(`[generate] job ${jobId} failed after ${Date.now() - start}ms:`, msg);
      await setJobError(jobId, msg);
    } finally {
      release?.();
    }
  })();

  // 让 Vercel 在响应返回后继续执行后台任务（本地 dev 无此上下文时忽略，浮动 Promise 仍在常驻进程中跑）
  try {
    waitUntil(task);
  } catch {
    /* 本地开发环境无 waitUntil 上下文，task 已作为浮动 Promise 启动 */
  }

  return NextResponse.json({ jobId });
}
