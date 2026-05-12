"use client";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { Card, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { PRESET_TEMPLATES } from "@/lib/mock-data";
import { mockGenerateAnalysis } from "@/lib/mock-api";
import { useProjectStore } from "@/lib/store";
import { Sparkles, ArrowRight } from "lucide-react";

export default function TemplatesPage() {
  const router = useRouter();
  const upsert = useProjectStore((s) => s.upsertProject);

  async function use(t: any) {
    const p = await mockGenerateAnalysis(t);
    upsert(p);
    router.push(`/workspace/${p.id}`);
  }

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-[1200px] px-6 py-10">
        <h1 className="text-xl font-semibold text-ink-900">模板库</h1>
        <p className="mt-1 text-sm text-ink-500">从预置模板快速开始一个分析。</p>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PRESET_TEMPLATES.map((t) => (
            <Card key={t.scenario} className="flex flex-col p-5 transition-all hover:border-brand/40 hover:shadow-pop">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand">
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="text-[15px] font-semibold text-ink-900">{t.industry}｜{t.scenario}</h3>
              <p className="mt-1 line-clamp-3 text-xs text-ink-500">{t.painPoints}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge>{t.outputPurpose}</Badge>
                <Badge>{t.depth}</Badge>
              </div>
              <Button size="sm" className="mt-4 self-start" onClick={() => use(t)}>
                使用模板 <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
