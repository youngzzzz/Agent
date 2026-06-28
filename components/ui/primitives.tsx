"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl2 border border-ink-300/60 bg-white shadow-card",
        className,
      )}
      {...p}
    />
  );
}

export function Badge({
  className, children, tone = "default",
}: { className?: string; children: React.ReactNode; tone?: "default" | "brand" | "success" | "warning" | "danger" }) {
  const tones = {
    default: "bg-ink-100 text-ink-700",
    brand: "bg-brand-50 text-brand-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-rose-50 text-rose-700",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-9 w-full rounded-lg border border-ink-300/70 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-500 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
        props.className,
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-[80px] w-full rounded-lg border border-ink-300/70 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-500 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-9 w-full rounded-lg border border-ink-300/70 bg-white px-3 text-sm text-ink-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
        props.className,
      )}
    />
  );
}

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={cn("mb-1.5 block text-xs font-medium text-ink-700", className)}>{children}</label>;
}
