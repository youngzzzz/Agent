export type LayerName = "business" | "ai" | "product" | "delivery";

export interface GenerateAnalysisInput {
  industry: string;
  scenario: string;
  targetUser?: string;
  painPoints?: string;
  outputPurpose: string;
  depth: string;
}

export interface ModuleItem {
  id: string;
  layerId: LayerName;
  title: string;
  summary: string;
  tags?: string[];
  bullets: string[];
  detail: string;
  deliverables: string[];
  risks: string[];
  suggestedPrompts: string[];
}

export interface Layer {
  id: LayerName;
  name: LayerName;
  title: string;
  description: string;
  modules: ModuleItem[];
}

export interface Project {
  id: string;
  name: string;
  industry: string;
  scenario: string;
  targetUser?: string;
  painPoints?: string;
  outputPurpose: string;
  depth: string;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "generating" | "generated" | "failed";
  error?: string;
  /** 后台生成任务 id：用于刷新页面后凭此续轮，恢复生成进度 */
  jobId?: string;
  layers: Layer[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  contextModuleId?: string;
}

/** 用户从方案页保存下来的模板：内含完整 Project 快照，可直接生成 PPT */
export interface SavedTemplate {
  id: string;
  name: string;
  industry: string;
  scenario: string;
  outputPurpose: string;
  depth: string;
  painPoints?: string;
  savedAt: string;
  /** 来源方案的 id，同一方案重复保存时覆盖更新 */
  sourceProjectId: string;
  /** 完整方案快照，生成 PPT 时无需再调用 LLM */
  project: Project;
}
