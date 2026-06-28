"use client";
import { MessageBlock, ChatRenderStyle, splitInline } from "@/lib/parse-message";
import { MermaidDiagram } from "./mermaid-diagram";
import { cn } from "@/lib/utils";

function Inline({ text }: { text: string }) {
  const parts = splitInline(text);
  return (
    <>
      {parts.map((p, i) => {
        if (p.bold) {
          return (
            <strong key={i} className="font-semibold text-ink-900">
              {p.text}
            </strong>
          );
        }
        if (p.italic) {
          return (
            <em key={i} className="italic text-ink-600">
              {p.text}
            </em>
          );
        }
        if (p.code) {
          return (
            <code
              key={i}
              className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[12px] text-brand-700"
            >
              {p.text}
            </code>
          );
        }
        if (p.strike) {
          return (
            <span key={i} className="text-ink-500 line-through">
              {p.text}
            </span>
          );
        }
        if (p.link) {
          return (
            <a
              key={i}
              href={p.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline decoration-brand/40 underline-offset-2 hover:text-brand-600"
            >
              {p.text}
            </a>
          );
        }
        return <span key={i}>{p.text}</span>;
      })}
    </>
  );
}

function BlockBody({
  block,
  style,
}: {
  block: MessageBlock;
  style: ChatRenderStyle;
}) {
  switch (block.type) {
    case "heading": {
      const sizes: Record<number, string> = {
        1: "text-[15px] font-semibold text-ink-900",
        2: "text-[14px] font-semibold text-ink-900",
        3: "text-[13px] font-medium text-ink-800",
        4: "text-[13px] font-semibold text-ink-800",
        5: "text-[12px] font-semibold text-ink-700",
        6: "text-[12px] font-medium text-ink-600",
      };
      const level = block.level;
      if (style === "notion") {
        return (
          <div
            className={cn(
              level === 1 && "border-b border-ink-200/80 pb-2",
              level === 2 && "mt-1 rounded-md bg-ink-50/80 px-2 py-1",
              level === 3 && "text-ink-800",
              level === 4 && "mt-2 border-l-[3px] border-brand/50 pl-2.5",
              level >= 5 && "mt-1 pl-2 text-ink-600",
              "mb-1",
            )}
          >
            <div className={sizes[level] || sizes[4]}>
              <Inline text={block.text} />
            </div>
          </div>
        );
      }
      if (style === "card") {
        return (
          <div className={cn(sizes[level] || sizes[4], level <= 2 && "mb-0.5", level === 4 && "mt-1")}>
            <Inline text={block.text} />
          </div>
        );
      }
      return (
        <div className={cn(sizes[level] || sizes[4], level <= 3 ? "text-brand-700" : "text-ink-700")}>
          <Inline text={block.text} />
        </div>
      );
    }

    case "paragraph":
      return (
        <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-700">
          <Inline text={block.text} />
        </p>
      );

    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border border-ink-200/80">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-ink-50/80">
                {block.headers.map((h, i) => (
                  <th
                    key={i}
                    className="border-b border-ink-200/80 px-3 py-2 text-left font-semibold text-ink-800"
                  >
                    <Inline text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 ? "bg-ink-50/40" : "bg-white"}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="border-b border-ink-200/60 px-3 py-2 align-top text-ink-700"
                    >
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "checklist":
      return (
        <ul className="space-y-1.5 text-[13px] text-ink-700">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2 leading-relaxed">
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]",
                  item.checked
                    ? "border-brand bg-brand text-white"
                    : "border-ink-300 bg-white text-transparent",
                )}
              >
                ✓
              </span>
              <span className={item.checked ? "text-ink-600" : undefined}>
                <Inline text={item.text} />
              </span>
            </li>
          ))}
        </ul>
      );

    case "list":
      if (block.ordered) {
        return (
          <ol className="ml-4 list-decimal space-y-1 text-[13px] text-ink-700">
            {block.items.map((item, i) => (
              <li key={i} className="leading-relaxed">
                <Inline text={item} />
              </li>
            ))}
          </ol>
        );
      }
      return (
        <ul className="space-y-1.5 text-[13px] text-ink-700">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2 leading-relaxed">
              <span
                className={cn(
                  "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                  style === "brief" ? "bg-brand" : "bg-indigo-400",
                )}
              />
              <span>
                <Inline text={item} />
              </span>
            </li>
          ))}
        </ul>
      );

    case "quote":
      return (
        <blockquote
          className={cn(
            "rounded-r-lg border-l-[3px] py-2 pl-3 pr-2 text-[13px] leading-relaxed text-ink-700",
            style === "card"
              ? "border-brand/50 bg-brand-50/40"
              : "border-indigo-400/70 bg-indigo-50/50",
          )}
        >
          <Inline text={block.text} />
        </blockquote>
      );

    case "code":
      return (
        <pre className="overflow-x-auto rounded-lg border border-ink-200/80 bg-ink-50 p-3 text-[12px] leading-relaxed text-ink-800">
          {block.code}
        </pre>
      );

    case "mermaid":
      return <MermaidDiagram code={block.code} />;

    case "divider":
      return <hr className="border-ink-200/80" />;

    default:
      return null;
  }
}

/** 卡片分区：按 h2 分段 */
function groupForCard(blocks: MessageBlock[]): MessageBlock[][] {
  const groups: MessageBlock[][] = [];
  let current: MessageBlock[] = [];

  for (const b of blocks) {
    if (b.type === "heading" && b.level <= 2 && current.length) {
      groups.push(current);
      current = [b];
    } else {
      current.push(b);
    }
  }
  if (current.length) groups.push(current);
  return groups.length ? groups : [blocks];
}

interface Props {
  content: string;
  style: ChatRenderStyle;
  blocks: MessageBlock[];
}

export function ChatMessageRenderer({ content, style, blocks }: Props) {
  if (!content.trim()) return null;

  if (style === "card") {
    const groups = groupForCard(blocks);
    return (
      <div className="space-y-2.5">
        {groups.map((group, gi) => (
          <div
            key={gi}
            className="rounded-lg border border-ink-200/70 bg-white p-3 shadow-card"
          >
            <div className="space-y-2">
              {group.map((block, bi) => (
                <BlockBody key={bi} block={block} style={style} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (style === "brief") {
    return (
      <div className="space-y-2">
        {blocks.map((block, i) => (
          <div
            key={i}
            className={cn(
              block.type !== "mermaid" && "border-l-2 border-brand/30 pl-2.5",
            )}
          >
            <BlockBody block={block} style={style} />
          </div>
        ))}
      </div>
    );
  }

  // notion 默认：整页文档感
  return (
    <div className="rounded-lg border border-ink-200/60 bg-white p-3.5 shadow-card">
      <div className="space-y-2.5">
        {blocks.map((block, i) => (
          <BlockBody key={i} block={block} style={style} />
        ))}
      </div>
    </div>
  );
}
