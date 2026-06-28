"use client";
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, icon, children, footer, className }: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full max-w-[420px] rounded-xl2 border border-ink-300/60 bg-white p-6 shadow-pop",
          "modal-pop",
          className,
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-700"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
        {(icon || title) && (
          <div className="mb-3 flex items-center gap-3 pr-6">
            {icon}
            {title && <h3 className="text-base font-semibold text-ink-900">{title}</h3>}
          </div>
        )}
        {children && <div className="text-sm leading-relaxed text-ink-600">{children}</div>}
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
