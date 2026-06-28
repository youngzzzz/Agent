/** 将 AI 回复文本解析为可渲染的内容块 */

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type MessageBlock =
  | { type: "heading"; level: HeadingLevel; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[]; ordered: boolean }
  | { type: "checklist"; items: { text: string; checked: boolean }[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "mermaid"; code: string }
  | { type: "code"; code: string; lang?: string }
  | { type: "quote"; text: string }
  | { type: "divider" };

export type ChatRenderStyle = "notion" | "card" | "brief";

export const CHAT_STYLE_OPTIONS: { id: ChatRenderStyle; label: string; desc: string }[] = [
  { id: "notion", label: "Notion 文档", desc: "块级排版、左侧强调线、阅读感强" },
  { id: "card", label: "卡片分区", desc: "每个章节独立卡片，层次清晰" },
  { id: "brief", label: "简报条目", desc: "紧凑编号列表，适合快速扫读" },
];

const FENCE_RE = /```(\w*)\n?([\s\S]*?)```/g;

export function parseMessageContent(content: string): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  FENCE_RE.lastIndex = 0;
  while ((match = FENCE_RE.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push(...parsePlainText(content.slice(lastIndex, match.index)));
    }
    const lang = (match[1] || "").toLowerCase();
    const code = match[2].trim();
    if (lang === "mermaid") {
      blocks.push({ type: "mermaid", code });
    } else {
      blocks.push({ type: "code", code, lang: lang || undefined });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    blocks.push(...parsePlainText(content.slice(lastIndex)));
  }

  return blocks.length ? blocks : [{ type: "paragraph", text: content.trim() }];
}

function parsePlainText(text: string): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (isDivider(trimmed)) {
      blocks.push({ type: "divider" });
      i++;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s*(.+)$/);
    if (heading && heading[2].trim()) {
      blocks.push({
        type: "heading",
        level: Math.min(heading[1].length, 6) as HeadingLevel,
        text: heading[2].trim(),
      });
      i++;
      continue;
    }

    // 数字小节：4.2 核心能力地图
    const section = trimmed.match(/^(\d+(?:\.\d+)+)\s+(.+)$/);
    if (section) {
      blocks.push({
        type: "heading",
        level: 4,
        text: `${section[1]} ${section[2]}`,
      });
      i++;
      continue;
    }

    // 中文章节：六、风险与对冲
    const cnChapter = trimmed.match(/^([一二三四五六七八九十百零〇两]+)[、.．]\s*(.+)$/);
    if (cnChapter) {
      blocks.push({
        type: "heading",
        level: 2,
        text: `${cnChapter[1]}、${cnChapter[2]}`,
      });
      i++;
      continue;
    }

    // 括号序号：（一）背景说明
    const cnParen = trimmed.match(/^（([一二三四五六七八九十\d]+)）\s*(.+)$/);
    if (cnParen) {
      blocks.push({
        type: "heading",
        level: 3,
        text: `（${cnParen[1]}）${cnParen[2]}`,
      });
      i++;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", text: quoteLines.join("\n") });
      continue;
    }

    if (isTableRow(trimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1].trim())) {
      const headers = splitTableCells(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i].trim()) && !isTableSeparator(lines[i].trim())) {
        rows.push(splitTableCells(lines[i].trim()));
        i++;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    const checkMatch = trimmed.match(/^\s*[-*•]\s+\[( |x|X)\]\s+(.+)$/);
    if (checkMatch) {
      const items: { text: string; checked: boolean }[] = [];
      while (i < lines.length) {
        const m = lines[i].trim().match(/^\s*[-*•]\s+\[( |x|X)\]\s+(.+)$/);
        if (!m) break;
        items.push({ text: m[2], checked: m[1].toLowerCase() === "x" });
        i++;
      }
      blocks.push({ type: "checklist", items });
      continue;
    }

    const ulMatch = trimmed.match(/^\s*[-*•]\s+(.+)$/);
    const olMatch = trimmed.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ulMatch || olMatch) {
      const ordered = !!olMatch;
      const items: string[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        const m = ordered ? t.match(/^\s*\d+[.)]\s+(.+)$/) : t.match(/^\s*[-*•]\s+(.+)$/);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push({ type: "list", items, ordered });
      continue;
    }

    const paraLines: string[] = [trimmed];
    i++;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (isStructuredLine(t, lines, i)) break;
      paraLines.push(t);
      i++;
    }
    blocks.push({ type: "paragraph", text: paraLines.join("\n") });
  }

  return blocks;
}

function isDivider(line: string): boolean {
  return /^(-{3,}|\*{3,}|_{3,})$/.test(line);
}

function isStructuredLine(t: string, lines: string[], i: number): boolean {
  if (!t) return true;
  if (/^#{1,6}\s*/.test(t)) return true;
  if (/^\d+(?:\.\d+)+\s+\S/.test(t)) return true;
  if (/^([一二三四五六七八九十百零〇两]+)[、.．]\s*.+/.test(t)) return true;
  if (/^（[一二三四五六七八九十\d]+）\s*.+/.test(t)) return true;
  if (/^\s*[-*•]\s+\[( |x|X)\]\s+/.test(t)) return true;
  if (/^\s*[-*•]\s+/.test(t)) return true;
  if (/^\s*\d+[.)]\s+/.test(t)) return true;
  if (t.startsWith(">")) return true;
  if (isDivider(t)) return true;
  if (isTableRow(t) && i + 1 < lines.length && isTableSeparator(lines[i + 1].trim())) return true;
  return false;
}

function isTableRow(line: string): boolean {
  return line.includes("|") && line.replace(/[^|]/g, "").length >= 2;
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:|-]+\|?$/.test(line) && line.includes("-") && line.includes("|");
}

function splitTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export interface InlineSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
  link?: string;
}

/** 行内解析：bold / italic / code / strike / link */
export function splitInline(text: string): InlineSpan[] {
  const parts: InlineSpan[] = [];
  const re =
    /\*\*(.+?)\*\*|~~(.+?)~~|\[([^\]]+)\]\(([^)]+)\)|\*(.+?)\*|`([^`]+?)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    if (m[1] !== undefined) parts.push({ text: m[1], bold: true });
    else if (m[2] !== undefined) parts.push({ text: m[2], strike: true });
    else if (m[3] !== undefined && m[4] !== undefined)
      parts.push({ text: m[3], link: m[4] });
    else if (m[5] !== undefined) parts.push({ text: m[5], italic: true });
    else if (m[6] !== undefined) parts.push({ text: m[6], code: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts.length ? parts : [{ text }];
}

export function isFlowchartRequest(text: string): boolean {
  return /生成流程图|流程图|flowchart|mindmap/i.test(text);
}

/**
 * 将一整段无换行的长文本按句末标点智能切分、按长度成组，
 * 让 LLM 生成的大段 detail 也能自然分段展示。
 */
export function segmentLongParagraph(
  text: string,
  opts: { maxLen?: number } = {},
): string[] {
  const maxLen = opts.maxLen ?? 140;
  const t = text.trim();
  if (t.length <= maxLen) return [t];

  // 按句末标点切句（保留标点），兼容中英文
  const sentences = t.match(/[^。！？；!?;]*[。！？；!?;]+|[^。！？；!?;]+$/g);
  if (!sentences || sentences.length <= 1) return [t];

  const paras: string[] = [];
  let cur = "";
  for (const raw of sentences) {
    const s = raw;
    if (cur && cur.length + s.length > maxLen) {
      paras.push(cur);
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) paras.push(cur);

  // 合并末尾过短的残段，避免出现一句话孤段
  if (paras.length >= 2 && paras[paras.length - 1].length < 24) {
    const tail = paras.pop()!;
    paras[paras.length - 1] += tail;
  }
  return paras;
}

/**
 * 对解析后的内容块做分段优化：仅拆分「无显式换行的长段落」，
 * 标题、列表、表格、代码、引用等结构块保持不变。
 */
export function segmentParagraphBlocks(blocks: MessageBlock[]): MessageBlock[] {
  const out: MessageBlock[] = [];
  for (const b of blocks) {
    if (b.type === "paragraph" && !b.text.includes("\n")) {
      const parts = segmentLongParagraph(b.text);
      for (const p of parts) out.push({ type: "paragraph", text: p });
    } else {
      out.push(b);
    }
  }
  return out;
}
