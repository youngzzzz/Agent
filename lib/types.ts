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
  layers: Layer[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  contextModuleId?: string;
}
