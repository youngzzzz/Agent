"use client";
import Link from "next/link";
import { Sparkles, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "工作台" },
  { href: "/history", label: "历史项目" },
  { href: "/templates", label: "模板库" },
  { href: "/help", label: "帮助" },
];

export function TopNav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-ink-300/60 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-indigo-500 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-ink-900">AI Transformation Canvas</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {items.map((it) => {
            const active = path === it.href;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active ? "bg-ink-100 text-ink-900" : "text-ink-500 hover:bg-ink-50 hover:text-ink-900",
                )}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/">
          <Button size="sm">
            <Plus className="h-4 w-4" /> 新建分析
          </Button>
        </Link>
      </div>
    </header>
  );
}
