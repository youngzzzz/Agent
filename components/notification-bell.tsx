"use client";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNotifyStore } from "@/lib/notify-store";
import { cn } from "@/lib/utils";

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function NotificationBell() {
  const items = useNotifyStore((s) => s.items);
  const unread = useNotifyStore((s) => s.unread);
  const clearUnread = useNotifyStore((s) => s.clearUnread);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      if (next) clearUnread();
      return next;
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900"
        aria-label="提醒"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-ink-300/60 bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-ink-900">提醒</span>
            <span className="text-xs text-ink-400">{items.length} 条已完成</span>
          </div>
          <div className="max-h-80 overflow-y-auto overscroll-contain">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-ink-400">
                暂无完成的任务
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-2.5 border-b border-ink-50 px-4 py-3 last:border-0"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold",
                      n.kind === "ppt"
                        ? "bg-indigo-50 text-indigo-600"
                        : "bg-emerald-50 text-emerald-600",
                    )}
                  >
                    {n.kind === "ppt" ? "PPT" : "方案"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs leading-relaxed text-ink-700">{n.message}</p>
                    <p className="mt-0.5 text-[11px] text-ink-400">{formatTime(n.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
