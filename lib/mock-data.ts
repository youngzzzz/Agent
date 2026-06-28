import { Project, Layer, ModuleItem, LayerName, GenerateAnalysisInput } from "./types";
import { uid } from "./utils";

const LAYER_META: Record<LayerName, { title: string; description: string }> = {
  business: {
    title: "业务层：行业问题、用户角色与商业价值",
    description: "理解行业现状、识别核心痛点、定义 AI 介入机会与商业指标",
  },
  ai: {
    title: "AI 应用层：模型能力、数据、工作流与评估",
    description: "选择合适的模型与工作流，设计数据、评估与人在回路机制",
  },
  product: {
    title: "产品层：功能模块、页面结构与用户体验",
    description: "把 AI 能力封装成具体的产品形态、用户流程与可量化指标",
  },
  delivery: {
    title: "交付层：POC、实施、商业化与客户成功",
    description: "把产品落地到真实客户、形成可复制的售前与交付体系",
  },
};

const MODULE_TEMPLATES: Record<LayerName, { title: string; tags?: string[] }[]> = {
  business: [
    { title: "目标客户" },
    { title: "核心业务痛点" },
    { title: "用户角色" },
    { title: "当前业务流程" },
    { title: "AI 介入机会" },
    { title: "ROI 与业务指标" },
    { title: "风险与限制" },
  ],
  ai: [
    { title: "AI 能力选择", tags: ["LLM", "Multimodal"] },
    { title: "数据来源", tags: ["Data", "ETL"] },
    { title: "RAG 知识库设计", tags: ["RAG", "Embedding"] },
    { title: "Agent 工作流", tags: ["Agent", "Workflow"] },
    { title: "Prompt / 工具调用", tags: ["Prompt", "Tool-use"] },
    { title: "质量评估", tags: ["Evaluation"] },
    { title: "安全与幻觉控制", tags: ["Safety", "Guardrail"] },
    { title: "Human-in-the-loop 机制", tags: ["HITL"] },
  ],
  product: [
    { title: "产品定位" },
    { title: "MVP 范围" },
    { title: "核心用户流程" },
    { title: "页面模块设计" },
    { title: "角色权限" },
    { title: "数据看板" },
    { title: "产品指标" },
    { title: "版本路线图" },
  ],
  delivery: [
    { title: "售前话术" },
    { title: "POC 方案" },
    { title: "数据初始化" },
    { title: "实施上线流程" },
    { title: "客户培训" },
    { title: "定价方式" },
    { title: "验收指标" },
    { title: "续费与增购" },
  ],
};

const SUGGESTED: Record<LayerName, string[]> = {
  business: ["继续展开", "转成咨询方案"],
  ai: ["生成技术方案", "生成流程图", "继续展开"],
  product: ["生成 PRD", "生成页面流程"],
  delivery: ["生成交付方案", "生成商业化方案", "继续展开"],
};

function buildModule(
  layer: LayerName,
  tpl: { title: string; tags?: string[] },
  industry: string,
  scenario: string,
): ModuleItem {
  return {
    id: uid("mod"),
    layerId: layer,
    title: tpl.title,
    summary: `围绕「${industry} · ${scenario}」给出关于「${tpl.title}」的关键判断与落地建议。`,
    tags: tpl.tags,
    bullets: [
      `结合 ${industry} 行业特征，明确「${tpl.title}」的边界与目标。`,
      `针对 ${scenario} 场景，识别 2-3 个最值得优化的环节。`,
      `给出可量化的成功指标与验证方式。`,
      `列出关键依赖：数据、组织、技术或客户配合。`,
      `输出可在两周内验证的最小动作。`,
    ],
    detail: `# ${tpl.title}\n\n本模块结合「${industry}」行业的 ${scenario} 场景，从现状洞察、机会识别、解决方案、验证路径四个角度给出深入拆解。\n\n## 关键判断\n- ${industry} 的 ${tpl.title} 与传统做法的核心差异在于流程数字化程度和数据可得性；\n- 在 ${scenario} 中，${tpl.title} 的优化空间集中在效率、转化与体验三类指标；\n- AI 的介入应优先服务于业务可观测的关键节点，而非全流程替代。\n\n## 落地建议\n1. 拆分场景：识别可结构化、可重复、容错率较高的子任务；\n2. 设计闭环：明确输入、模型动作、输出反馈与人工兜底；\n3. 定义指标：转化率、人均处理量、客户满意度等。`,
    deliverables: [
      `${tpl.title} 一页纸方案（PPT / Markdown）`,
      `${tpl.title} 可量化指标卡`,
      `${tpl.title} 验证实验设计`,
    ],
    risks: [
      `数据可得性不足，可能导致方案落地时缺少冷启动样本`,
      `业务方对 AI 的预期管理不到位，容易出现幻觉容忍度问题`,
    ],
    suggestedPrompts: SUGGESTED[layer],
  };
}

export function buildProject(input: GenerateAnalysisInput, presetName?: string): Project {
  const now = new Date().toISOString();
  const layers: Layer[] = (Object.keys(MODULE_TEMPLATES) as LayerName[]).map((ln) => ({
    id: ln,
    name: ln,
    title: LAYER_META[ln].title,
    description: LAYER_META[ln].description,
    modules: MODULE_TEMPLATES[ln].map((t) => buildModule(ln, t, input.industry, input.scenario)),
  }));
  return {
    id: uid("prj"),
    name: presetName || `${input.industry}｜${input.scenario}`,
    industry: input.industry,
    scenario: input.scenario,
    targetUser: input.targetUser,
    painPoints: input.painPoints,
    outputPurpose: input.outputPurpose,
    depth: input.depth,
    createdAt: now,
    updatedAt: now,
    status: "generated",
    layers,
  };
}

export const PRESET_TEMPLATES: GenerateAnalysisInput[] = [
  {
    industry: "口腔健康行业",
    scenario: "口腔健康Agent",
    targetUser: "口腔诊所、连锁齿科与有口腔护理需求的用户",
    painPoints: "缺乏个性化口腔健康管理、复诊提醒难、患者教育与转化效率低",
    outputPurpose: "产品方案",
    depth: "深度版",
  },
  {
    industry: "智能耳机行业",
    scenario: "智能睡眠耳机",
    targetUser: "有睡眠障碍、追求睡眠质量的用户",
    painPoints: "入睡难、睡眠监测不准、降噪与佩戴舒适度难以兼顾",
    outputPurpose: "产品方案",
    depth: "深度版",
  },
  {
    industry: "ToB AI 行业",
    scenario: "AgentOS",
    targetUser: "需要构建与运营 AI Agent 的企业与开发团队",
    painPoints: "Agent 编排复杂、工具接入成本高、可观测与治理能力不足",
    outputPurpose: "产品方案",
    depth: "深度版",
  },
  {
    industry: "教育行业",
    scenario: "招生转化 AI 助手",
    targetUser: "K12 / 职业培训机构招生顾问",
    painPoints: "线索池大但跟进效率低、个性化不足、转化率波动大",
    outputPurpose: "产品方案",
    depth: "标准版",
  },
  {
    industry: "toB 软件行业",
    scenario: "标书 AI 生成系统",
    targetUser: "解决方案 / 售前 / 投标团队",
    painPoints: "投标周期短、标书复用率低、专家资源稀缺",
    outputPurpose: "咨询交付",
    depth: "深度版",
  },
  {
    industry: "高端旅游行业",
    scenario: "AI 定制旅行顾问",
    targetUser: "高净值定制游客户与顾问",
    painPoints: "需求复杂沟通成本高、顾问产能有限、产品组合难以个性化",
    outputPurpose: "创业验证",
    depth: "标准版",
  },
];

export const SAMPLE_PROJECTS: Project[] = PRESET_TEMPLATES.map((t) => buildProject(t));
