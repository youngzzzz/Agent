import { GenerateAnalysisInput, ModuleItem, Project } from "./types";

/** 业务层 / AI 应用层 / 产品层 / 交付层的固定模板，要求 LLM 严格按此结构产出。 */
const LAYER_SCHEMA = `
{
  "layers": [
    {
      "id": "business" | "ai" | "product" | "delivery",
      "title": string,
      "description": string,
      "modules": [
        {
          "title": string,
          "summary": string,
          "tags"?: string[],
          "bullets": string[],   // 3-5 条要点
          "detail": string,       // Markdown，详细拆解
          "deliverables": string[],
          "risks": string[],
          "suggestedPrompts": string[]
        }
      ]
    }
  ]
}
`.trim();

const REQUIRED_MODULES = `
- business（7 个）：目标客户、核心业务痛点、用户角色、当前业务流程、AI 介入机会、ROI 与业务指标、风险与限制
- ai（8 个）：AI 能力选择、数据来源、RAG 知识库设计、Agent 工作流、Prompt / 工具调用、质量评估、安全与幻觉控制、Human-in-the-loop 机制
- product（8 个）：产品定位、MVP 范围、核心用户流程、页面模块设计、角色权限、数据看板、产品指标、版本路线图
- delivery（8 个）：售前话术、POC 方案、数据初始化、实施上线流程、客户培训、定价方式、验收指标、续费与增购
`.trim();

export const SYSTEM_GENERATE = `你是资深 AI 产品顾问与行业解决方案架构师。
任务：根据用户输入的"行业 + 业务场景"，输出一套四层 AI 应用拆解方案。

要求：
1. 严格输出 JSON，不要任何额外文字、不要 Markdown 代码块包裹。
2. 必须包含 4 个 layer，顺序：business、ai、product、delivery。
3. 每层模块名称必须严格对应：
${REQUIRED_MODULES}
4. 每个 module 的 bullets 控制在 3-5 条，detail 用 Markdown 写 200-400 字。
5. 语言专业、克制、可落地，避免空话套话。

输出 JSON Schema：
${LAYER_SCHEMA}`;

export function buildGenerateUserPrompt(input: GenerateAnalysisInput) {
  return [
    `行业：${input.industry}`,
    `业务场景：${input.scenario}`,
    input.targetUser ? `目标客户：${input.targetUser}` : null,
    input.painPoints ? `当前痛点：${input.painPoints}` : null,
    `输出用途：${input.outputPurpose}`,
    `方案深度：${input.depth}`,
    "",
    "请直接输出符合 schema 的 JSON。",
  ].filter(Boolean).join("\n");
}

export const SYSTEM_CHAT = `你是该 AI 应用拆解方案的产品顾问。
始终基于"当前项目 + 当前模块"的上下文回答，回答专业、结构化、可执行。
如果用户要求生成 PRD / 流程图 / 技术方案 / 面试讲法 / 咨询方案，请直接产出，使用 Markdown。`;

export function buildChatContext(project: Project, m?: ModuleItem) {
  const ctx = [
    `# 当前项目`,
    `- 名称：${project.name}`,
    `- 行业：${project.industry}`,
    `- 场景：${project.scenario}`,
    project.targetUser ? `- 目标客户：${project.targetUser}` : "",
    project.painPoints ? `- 痛点：${project.painPoints}` : "",
  ].filter(Boolean).join("\n");

  if (!m) return ctx;
  return `${ctx}\n\n# 当前模块\n- 层级：${m.layerId}\n- 模块：${m.title}\n- 摘要：${m.summary}\n- 要点：\n${m.bullets.map((b) => `  - ${b}`).join("\n")}`;
}
