import { NextRequest, NextResponse } from "next/server";
import { chatCompletionStream } from "@/lib/llm";
import { buildProject } from "@/lib/mock-data";
import { GenerateAnalysisInput } from "@/lib/types";

const SYSTEM_PROMPT = `你是 AI 转型咨询专家，擅长将任意行业场景拆解为一套可落地的 AI 产品方案。
请严格按照四层结构输出：业务层(business)、AI应用层(ai)、产品层(product)、交付层(delivery)。
每个模块需要包含：标题、摘要、要点、详情、可落地产物、风险、建议提示词。
返回合法的 JSON 对象，结构如下：
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
    {
      "id": "business",
      "name": "business",
      "title": "业务层",
      "description": "业务层定义",
      "modules": []
    },
    {
      "id": "ai",
      "name": "ai",
      "title": "AI应用层",
      "description": "AI应用层定义",
      "modules": []
    },
    {
      "id": "product",
      "name": "product",
      "title": "产品层",
      "description": "产品层定义",
      "modules": []
    },
    {
      "id": "delivery",
      "name": "delivery",
      "title": "交付层",
      "description": "交付层定义",
      "modules": []
    }
  ]
}`;

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const input: GenerateAnalysisInput = await req.json();
    const userPrompt = `行业：${input.industry}
场景：${input.scenario}
${input.targetUser ? `目标用户：${input.targetUser}` : ""}
${input.painPoints ? `痛点：${input.painPoints}` : ""}
输出目的：${input.outputPurpose}
深度：${input.depth}`;

    const llmStart = Date.now();
    const text = await chatCompletionStream(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { max_tokens: 8000 },
      () => {},
    );
    const llmMs = Date.now() - llmStart;
    console.info(`[generate] LLM call took ${llmMs}ms`);

    let project;
    // 去除所有 markdown code fence（可能有嵌套）
    let stripped = text.replace(/```json\s*|```\s*/gi, "").trim();
    try {
      project = JSON.parse(stripped);
    } catch {
      console.warn("[generate] invalid JSON after strip, fallback to mock", {
        textPreview: stripped.slice(0, 500),
        textLen: stripped.length,
      });
      return NextResponse.json(buildProject(input));
    }

    if (!project.layers || !Array.isArray(project.layers)) {
      console.warn("[generate] invalid structure, fallback to mock", {
        hasLayers: !!project.layers,
        isArray: Array.isArray(project.layers),
      });
      return NextResponse.json(buildProject(input));
    }

    // 规范化模块字段（兼容中文字段名）
    for (const layer of project.layers) {
      if (layer.modules) {
        for (const mod of layer.modules) {
          if (!mod.id) mod.id = `mod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          if (!mod.layerId) mod.layerId = layer.id;
          // 先做字段映射，再确保 bullets 是数组
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
          if (mod.标签 && Array.isArray(mod.标签)) mod.tags = mod.标签.map((t: any) => typeof t === "string" ? t : t.name || t.title || JSON.stringify(t));
          // tags 必须是字符串数组
          if (mod.tags && Array.isArray(mod.tags)) {
            mod.tags = mod.tags.map((t: any) => typeof t === "string" ? t : t.name || t.title || JSON.stringify(t));
          }
          // 确保 bullets 是数组
          if (!mod.bullets || !Array.isArray(mod.bullets)) mod.bullets = [];
          if (!mod.deliverables || !Array.isArray(mod.deliverables)) mod.deliverables = [];
          if (!mod.risks || !Array.isArray(mod.risks)) mod.risks = [];
          if (!mod.suggestedPrompts || !Array.isArray(mod.suggestedPrompts)) mod.suggestedPrompts = [];
        }
      }
    }

    project.id = project.id || `proj_${Date.now()}`;
    // 使用中国时区 (UTC+8)，强制覆盖 LLM 返回的假时间
    const cstNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const cstISO = cstNow.toISOString().replace("T", " ").slice(0, 19) + "+08:00";
    project.createdAt = cstISO;
    project.updatedAt = cstISO;
    project.status = "generated";

    console.info(`[generate] total ${Date.now() - start}ms, LLM ${llmMs}ms`);
    return NextResponse.json(project);
  } catch (err: any) {
    console.error(`[generate] error after ${Date.now() - start}ms:`, err);
    return NextResponse.json(
      { error: err?.message || "生成失败" },
      { status: 500 },
    );
  }
}
