"use client";
import * as React from "react";
import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2 } from "lucide-react";

interface ToastItem { id: number; text: string; }
const Ctx = createContext<{ toast: (text: string) => void }>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 2400);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2 rounded-lg border border-ink-300/60 bg-white px-3 py-2 text-sm shadow-pop"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-ink-700">{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() { return useContext(Ctx); }
