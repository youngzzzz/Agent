import { TopNav } from "@/components/top-nav";
import { Card } from "@/components/ui/primitives";

export default function HelpPage() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-[860px] px-6 py-10">
        <h1 className="text-xl font-semibold text-ink-900">帮助</h1>
        <p className="mt-1 text-sm text-ink-500">关于 AI Transformation Canvas 的使用说明。</p>
        <div className="mt-6 space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-ink-900">什么是四层拆解？</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">
              业务层 / AI 应用层 / 产品层 / 交付层。从行业问题到落地交付，给出一个可被讨论与迭代的整体框架。
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-ink-900">如何接入真实大模型？</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">
              在 <code className="rounded bg-ink-100 px-1">lib/mock-api.ts</code> 中替换{" "}
              <code className="rounded bg-ink-100 px-1">generateAnalysisWithLLM</code> 与{" "}
              <code className="rounded bg-ink-100 px-1">chatWithModuleContext</code> 为真实接口调用即可，
              数据结构保持兼容。
            </p>
          </Card>
        </div>
      </main>
    </div>
  );
}
