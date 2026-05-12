"use client";
import Link from "next/link";
import { TopNav } from "@/components/top-nav";
import { Card, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { Trash2, ArrowRight, FolderOpen } from "lucide-react";

export default function HistoryPage() {
  const { toast } = useToast();
  const projects = useProjectStore((s) => s.projects);
  const del = useProjectStore((s) => s.deleteProject);

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-[1200px] px-6 py-10">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink-900">历史项目</h1>
            <p className="mt-1 text-sm text-ink-500">所有生成过的四层拆解方案，本地存储。</p>
          </div>
          <Link href="/"><Button size="sm">新建分析</Button></Link>
        </div>

        {projects.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-16 text-center">
            <FolderOpen className="mb-3 h-8 w-8 text-ink-300" />
            <p className="text-sm text-ink-500">还没有历史项目</p>
            <Link href="/" className="mt-3"><Button size="sm">立即创建</Button></Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (
              <Card key={p.id} className="flex flex-col p-5 transition-all hover:border-brand/40 hover:shadow-pop">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-[15px] font-semibold text-ink-900">{p.name}</h3>
                  <Badge tone={p.status === "generated" ? "success" : "default"}>
                    {p.status === "generated" ? "已生成" : "草稿"}
                  </Badge>
                </div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <Badge tone="brand">{p.industry}</Badge>
                  <Badge>{p.scenario}</Badge>
                  <Badge>{p.outputPurpose}</Badge>
                </div>
                <dl className="space-y-1 text-xs text-ink-500">
                  <Row k="目标客户" v={p.targetUser || "—"} />
                  <Row k="创建于" v={formatDate(p.createdAt)} />
                  <Row k="更新于" v={formatDate(p.updatedAt)} />
                </dl>
                <div className="mt-4 flex items-center gap-2">
                  <Link href={`/workspace/${p.id}`} className="flex-1">
                    <Button size="sm" variant="primary" className="w-full">
                      打开 <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Button
                    size="icon" variant="outline"
                    onClick={() => { del(p.id); toast("已删除"); }}
                  >
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0">{k}</dt>
      <dd className="truncate text-ink-700">{v}</dd>
    </div>
  );
}
