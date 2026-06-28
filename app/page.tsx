"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { Card, Input, Label, Select, Textarea, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useGeneration } from "@/components/generation-provider";
import { PRESET_TEMPLATES } from "@/lib/mock-data";
import { GenerateAnalysisInput } from "@/lib/types";
import { Sparkles, ArrowRight, GraduationCap, FileSpreadsheet, Plane, Clock, Smile, Headphones, Bot } from "lucide-react";

const PURPOSES = ["行业分析", "产品方案", "咨询交付", "创业验证"];
// 深度版暂时隐藏（后端仍支持，传入「深度版」仍可生成）：标准版当前稳定无失败。
const DEPTHS = ["快速版", "标准版"];

export default function HomePage() {
  const router = useRouter();
  const { startGeneration } = useGeneration();
  const [taskModal, setTaskModal] = useState<{ open: boolean; name: string }>({ open: false, name: "" });
  const [form, setForm] = useState<GenerateAnalysisInput>({
    industry: "",
    scenario: "",
    targetUser: "",
    painPoints: "",
    outputPurpose: "产品方案",
    depth: "标准版",
  });

  function update<K extends keyof GenerateAnalysisInput>(k: K, v: GenerateAnalysisInput[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function submit(input?: GenerateAnalysisInput) {
    const payload = input || form;
    if (!payload.industry || !payload.scenario) return;
    const name = `${payload.industry}｜${payload.scenario}`;
    startGeneration(payload);
    setTaskModal({ open: true, name });
  }

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-[1100px] px-6 py-12">
        <section className="mb-10 text-center">
          <Badge tone="brand" className="mx-auto mb-4 inline-flex">
            <Sparkles className="mr-1 h-3 w-3" /> AI Transformation Canvas
          </Badge>
          <h1 className="text-[34px] font-semibold leading-tight tracking-tight text-ink-900">
            把任意行业场景，拆成一套可落地的 AI 产品方案
          </h1>
          <p className="mx-auto mt-3 max-w-[640px] text-[15px] leading-relaxed text-ink-500">
            输入行业和场景，自动生成业务层、AI 应用层、产品层、交付层四层拆解，
            并支持继续与 AI 深挖每个模块。
          </p>
        </section>

        <Card className="p-6 md:p-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>目标行业 *</Label>
              <Input
                value={form.industry}
                placeholder="例如：教育行业 / toB 软件 / 高端旅游"
                onChange={(e) => update("industry", e.target.value)}
              />
            </div>
            <div>
              <Label>具体场景 *</Label>
              <Input
                value={form.scenario}
                placeholder="例如：招生转化 AI 助手"
                onChange={(e) => update("scenario", e.target.value)}
              />
            </div>
            <div>
              <Label>目标客户（可选）</Label>
              <Input
                value={form.targetUser}
                placeholder="例如：K12 招生顾问 / 售前团队"
                onChange={(e) => update("targetUser", e.target.value)}
              />
            </div>
            <div>
              <Label>输出用途</Label>
              <Select value={form.outputPurpose} onChange={(e) => update("outputPurpose", e.target.value)}>
                {PURPOSES.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>当前痛点（可选）</Label>
              <Textarea
                value={form.painPoints}
                placeholder="例如：线索池大但跟进效率低、个性化不足、转化率波动大"
                onChange={(e) => update("painPoints", e.target.value)}
              />
            </div>
            <div>
              <Label>方案深度</Label>
              <Select value={form.depth} onChange={(e) => update("depth", e.target.value)}>
                {DEPTHS.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button size="lg" onClick={() => submit()} disabled={!form.industry || !form.scenario}>
              <Sparkles className="h-4 w-4" />
              生成四层拆解方案
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-700">示例模板</h3>
            <span className="text-xs text-ink-500">点击直接生成</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {PRESET_TEMPLATES.map((t, i) => {
              const Icon = [Smile, Headphones, Bot, GraduationCap, FileSpreadsheet, Plane][i] || Sparkles;
              return (
                <Card
                  key={t.scenario}
                  className="cursor-pointer p-5 transition-all hover:border-brand/40 hover:shadow-pop"
                  onClick={() => submit(t)}
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold text-ink-900">{t.industry}｜{t.scenario}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-500">{t.painPoints}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge>{t.outputPurpose}</Badge>
                    <Badge>{t.depth}</Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      </main>

      <Modal
        open={taskModal.open}
        onClose={() => setTaskModal({ open: false, name: "" })}
        icon={
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand">
            <Clock className="h-4 w-4" />
          </span>
        }
        title="生成任务已创建"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setTaskModal({ open: false, name: "" })}>
              继续创建
            </Button>
            <Button size="sm" onClick={() => router.push("/history")}>
              查看方案生成进度 <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </>
        }
      >
        <p>
          <span className="font-medium text-ink-900">「{taskModal.name}」</span>
          正在后台生成，预计需要 1–2 分钟。
        </p>
        <p className="mt-2">
          完成后会在右下角通知你，期间可继续创建其他方案。可在
          <span className="font-medium text-ink-700">「历史项目」</span>中查看生成进度。
        </p>
      </Modal>
    </div>
  );
}
