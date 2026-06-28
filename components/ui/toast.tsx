"use client";
import * as React from "react";
import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, X } from "lucide-react";

interface ToastItem { id: number; text: string; }

interface ToastOptions {
  /** 自动关闭毫秒数，默认 2400；设为 0 则不自动关闭 */
  duration?: number;
}

const Ctx = createContext<{ toast: (text: string, opts?: ToastOptions) => void }>({
  toast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((s) => s.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (text: string, opts?: ToastOptions) => {
      const id = Date.now() + Math.random();
      setItems((s) => [...s, { id, text }]);
      const duration = opts?.duration ?? 2400;
      if (duration > 0) {
        setTimeout(() => remove(id), duration);
      }
    },
    [remove],
  );

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2 rounded-lg border border-ink-300/60 bg-white px-3 py-2 text-sm shadow-pop"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="text-ink-700">{t.text}</span>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="ml-1 shrink-0 rounded p-0.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
              aria-label="关闭"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() { return useContext(Ctx); }
