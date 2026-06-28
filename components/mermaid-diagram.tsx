"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { GitBranch, Maximize2, ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react";

interface Props {
  code: string;
  title?: string;
}

let mermaidReady = false;

async function initMermaid() {
  if (mermaidReady) return;
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: "base",
    themeVariables: {
      primaryColor: "#eef2ff",
      primaryTextColor: "#334155",
      primaryBorderColor: "#6366f1",
      lineColor: "#94a3b8",
      secondaryColor: "#f8fafc",
      tertiaryColor: "#fff",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    },
    flowchart: {
      htmlLabels: true,
      curve: "basis",
      padding: 16,
      nodeSpacing: 48,
      rankSpacing: 56,
    },
    mindmap: {
      padding: 20,
      useMaxWidth: true,
    },
  });
  mermaidReady = true;
}

const MIN_SCALE = 0.4;
const MAX_SCALE = 4;

export function MermaidDiagram({ code, title = "流程图" }: Props) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await initMermaid();
        const mermaid = (await import("mermaid")).default;
        const id = `mmd-${Math.random().toString(36).slice(2, 9)}`;
        const { svg: rendered } = await mermaid.render(id, code);
        if (!cancelled) {
          setSvg(rendered);
          setError("");
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "流程图渲染失败");
          setSvg("");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  const canZoom = !!svg && !error;

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-indigo-200/80 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 shadow-sm">
        <div className="flex items-center justify-between border-b border-indigo-100/80 bg-white/80 px-3 py-2">
          <div className="flex items-center gap-2 text-xs font-medium text-indigo-700">
            <GitBranch className="h-3.5 w-3.5" />
            {title}
          </div>
          <button
            type="button"
            disabled={!canZoom}
            onClick={() => canZoom && setLightboxOpen(true)}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-ink-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            title="放大查看"
          >
            <Maximize2 className="h-3 w-3" /> 放大查看
          </button>
        </div>
        <div
          className={canZoom ? "xmind-canvas overflow-x-auto p-4 cursor-zoom-in" : "xmind-canvas overflow-x-auto p-4"}
          onClick={() => canZoom && setLightboxOpen(true)}
          style={{
            backgroundImage:
              "radial-gradient(circle, #e2e8f0 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        >
          {error ? (
            <pre className="whitespace-pre-wrap rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</pre>
          ) : svg ? (
            <div
              className="mx-auto min-w-max [&_svg]:max-w-none"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <div className="flex h-32 items-center justify-center text-xs text-ink-500">
              正在渲染流程图…
            </div>
          )}
        </div>
      </div>

      {lightboxOpen && (
        <DiagramLightbox svg={svg} title={title} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  );
}

function DiagramLightbox({
  svg,
  title,
  onClose,
}: {
  svg: string;
  title: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; ox: number; oy: number }>({
    active: false,
    startX: 0,
    startY: 0,
    ox: 0,
    oy: 0,
  });

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const zoomBy = useCallback((delta: number) => {
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(s + delta).toFixed(2))));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") zoomBy(0.2);
      else if (e.key === "-" || e.key === "_") zoomBy(-0.2);
      else if (e.key === "0") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, zoomBy, reset]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomBy(e.deltaY > 0 ? -0.15 : 0.15);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current.active) return;
    setOffset({
      x: dragRef.current.ox + (e.clientX - dragRef.current.startX),
      y: dragRef.current.oy + (e.clientY - dragRef.current.startY),
    });
  };

  const endDrag = () => {
    dragRef.current.active = false;
  };

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-ink-900/70 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <GitBranch className="h-4 w-4" />
          {title}
        </div>
        <div className="flex items-center gap-1.5">
          <ToolButton onClick={() => zoomBy(-0.2)} title="缩小">
            <ZoomOut className="h-4 w-4" />
          </ToolButton>
          <span className="w-12 text-center text-xs tabular-nums text-white/80">
            {Math.round(scale * 100)}%
          </span>
          <ToolButton onClick={() => zoomBy(0.2)} title="放大">
            <ZoomIn className="h-4 w-4" />
          </ToolButton>
          <ToolButton onClick={reset} title="重置">
            <RotateCcw className="h-4 w-4" />
          </ToolButton>
          <ToolButton onClick={onClose} title="关闭 (Esc)">
            <X className="h-4 w-4" />
          </ToolButton>
        </div>
      </div>
      <div
        className="relative flex-1 overflow-hidden"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        style={{
          cursor: dragRef.current.active ? "grabbing" : "grab",
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        <div
          className="absolute left-1/2 top-1/2 [&_svg]:max-w-none"
          style={{
            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: dragRef.current.active ? "none" : "transform 0.08s ease-out",
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink-900/50 px-3 py-1 text-[11px] text-white/70">
          滚轮缩放 · 拖拽平移 · Esc 关闭
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/15 hover:text-white"
    >
      {children}
    </button>
  );
}
