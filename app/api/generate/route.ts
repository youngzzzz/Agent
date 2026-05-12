import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GenerateAnalysisInput, Layer, LayerName, Project } from "@/lib/types";
import { SYSTEM_GENERATE, buildGenerateUserPrompt } from "@/lib/prompts";
import { uid } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const input = (await req.json()) as GenerateAnalysisInput;
    if (!input?.industry || !input?.scenario) {
      return NextResponse.json({ error: "industry & scenario are required" }, { status: 400 });
    }

    // Use streaming because max_tokens is high (~16K) — required by SDK to avoid timeouts.
    // Prompt-cache the system block so repeated generations on the same template share prefix.
    const stream = client.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      thinking: { type: "adaptive" } as any,
      output_config: { effort: "high" } as any,
      system: [
        { type: "text", text: SYSTEM_GENERATE, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: buildGenerateUserPrompt(input) }],
    } as any);

    const message = await stream.finalMessage();
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const parsed = safeParseJson(text);
    if (!parsed?.layers || !Array.isArray(parsed.layers)) {
      return NextResponse.json(
        { error: "LLM returned invalid JSON", raw: text.slice(0, 800) },
        { status: 502 },
      );
    }

    const project: Project = {
      id: uid("prj"),
      name: `${input.industry}｜${input.scenario}`,
      industry: input.industry,
      scenario: input.scenario,
      targetUser: input.targetUser,
      painPoints: input.painPoints,
      outputPurpose: input.outputPurpose,
      depth: input.depth,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "generated",
      layers: normalizeLayers(parsed.layers),
    };

    return NextResponse.json(project);
  } catch (err: any) {
    console.error("[/api/generate]", err);
    const status = err?.status ?? 500;
    return NextResponse.json(
      { error: err?.message ?? "Internal error", type: err?.type },
      { status },
    );
  }
}

function safeParseJson(text: string): any | null {
  // Strip code fences just in case the model added them.
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: extract the first {...} block.
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }
}

function normalizeLayers(raw: any[]): Layer[] {
  return raw.map((l) => ({
    id: l.id as LayerName,
    name: l.id as LayerName,
    title: String(l.title ?? ""),
    description: String(l.description ?? ""),
    modules: (l.modules ?? []).map((m: any) => ({
      id: uid("mod"),
      layerId: l.id as LayerName,
      title: String(m.title ?? ""),
      summary: String(m.summary ?? ""),
      tags: Array.isArray(m.tags) ? m.tags.map(String) : undefined,
      bullets: Array.isArray(m.bullets) ? m.bullets.map(String) : [],
      detail: String(m.detail ?? ""),
      deliverables: Array.isArray(m.deliverables) ? m.deliverables.map(String) : [],
      risks: Array.isArray(m.risks) ? m.risks.map(String) : [],
      suggestedPrompts: Array.isArray(m.suggestedPrompts)
        ? m.suggestedPrompts.map(String)
        : ["继续展开", "生成 PRD", "和 AI 讨论"],
    })),
  }));
}
