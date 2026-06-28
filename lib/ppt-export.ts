import { Layer, ModuleItem, Project } from "./types";
import { parseMessageContent, segmentParagraphBlocks, MessageBlock } from "./parse-message";

/* ------------------------------------------------------------------ *
 * 主题：高级灰 + 白色背景 + 蓝紫色强调色，专业 / 现代 / 干净 / 轻量
 * ------------------------------------------------------------------ */
const T = {
  white: "FFFFFF",
  ink: "1E293B", // 标题 - slate-800
  body: "475569", // 正文 - slate-600
  muted: "94A3B8", // 次要 - slate-400
  accent: "6366F1", // 强调 - 蓝紫
  accentDark: "4F46E5",
  panel: "F1F5F9", // 浅灰面板 - slate-100
  panelSoft: "F8FAFC", // 更浅 - slate-50
  border: "E2E8F0", // 描边 - slate-200
};

const FONT = "微软雅黑";

const LAYER_ORDER: Layer["id"][] = ["business", "ai", "product", "delivery"];
const LAYER_LABEL: Record<string, string> = {
  business: "业务层",
  ai: "AI 应用层",
  product: "产品层",
  delivery: "交付层",
};

/** 去除行内 Markdown 标记，PPT 不渲染 markdown */
function stripInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/`([^`]+?)`/g, "$1")
    .replace(/(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g, "$1")
    .trim();
}

/** 把模块 detail（Markdown）转换为 PPT 文本 runs */
function detailToRuns(detail: string): any[] {
  const blocks: MessageBlock[] = segmentParagraphBlocks(parseMessageContent(detail || ""));
  const runs: any[] = [];

  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        runs.push({
          text: stripInline(b.text),
          options: { bold: true, color: T.ink, fontSize: 11, breakLine: true, paraSpaceBefore: 6, paraSpaceAfter: 2 },
        });
        break;
      case "paragraph":
        runs.push({
          text: stripInline(b.text),
          options: { color: T.body, fontSize: 10.5, breakLine: true, paraSpaceAfter: 4, lineSpacingMultiple: 1.15 },
        });
        break;
      case "list":
        for (const it of b.items) {
          runs.push({
            text: stripInline(it),
            options: { color: T.body, fontSize: 10.5, bullet: { code: "2022", indent: 14 }, breakLine: true, lineSpacingMultiple: 1.1 },
          });
        }
        break;
      case "checklist":
        for (const it of b.items) {
          runs.push({
            text: stripInline(it.text),
            options: { color: T.body, fontSize: 10.5, bullet: { code: "2713", indent: 14 }, breakLine: true },
          });
        }
        break;
      case "quote":
        runs.push({
          text: stripInline(b.text),
          options: { italic: true, color: T.accent, fontSize: 10.5, breakLine: true, paraSpaceBefore: 2, paraSpaceAfter: 4 },
        });
        break;
      case "table":
        runs.push({
          text: b.headers.map(stripInline).join("  ｜  "),
          options: { bold: true, color: T.ink, fontSize: 10, breakLine: true, paraSpaceBefore: 4 },
        });
        for (const row of b.rows) {
          runs.push({
            text: row.map(stripInline).join("  ｜  "),
            options: { color: T.body, fontSize: 10, breakLine: true },
          });
        }
        break;
      case "code":
        runs.push({
          text: b.code,
          options: { fontFace: "Consolas", color: T.body, fontSize: 9.5, breakLine: true },
        });
        break;
      default:
        break;
    }
  }

  if (runs.length === 0) {
    runs.push({ text: stripInline(detail || "（暂无详情）"), options: { color: T.body, fontSize: 10.5, breakLine: true } });
  }
  return runs;
}

/** 内容页统一页眉：小标签 + 大标题 + 强调下划线 */
function addHeader(pptx: any, slide: any, kicker: string, title: string) {
  slide.addText(kicker.toUpperCase(), {
    x: 0.6, y: 0.4, w: 12.1, h: 0.3,
    fontFace: FONT, fontSize: 10, color: T.accent, bold: true, charSpacing: 3,
  });
  slide.addText(title, {
    x: 0.6, y: 0.68, w: 12.1, h: 0.6,
    fontFace: FONT, fontSize: 23, color: T.ink, bold: true,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.62, y: 1.36, w: 0.62, h: 0.06, fill: { color: T.accent }, line: { type: "none" },
  });
}

/** 页脚 */
function addFooter(slide: any, projectName: string, page: string) {
  slide.addText(projectName, {
    x: 0.6, y: 7.05, w: 9, h: 0.3, fontFace: FONT, fontSize: 8, color: T.muted, align: "left",
  });
  slide.addText(page, {
    x: 10.7, y: 7.05, w: 2.03, h: 0.3, fontFace: FONT, fontSize: 8, color: T.muted, align: "right",
  });
}

function shortText(s: string, max: number): string {
  const t = (s || "").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

/* ------------------------------------------------------------------ *
 * 各类幻灯片
 * ------------------------------------------------------------------ */

function addCover(pptx: any, project: Project) {
  const slide = pptx.addSlide();
  slide.background = { color: T.white };

  // 左侧强调竖条
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.3, h: 7.5, fill: { color: T.accent }, line: { type: "none" } });
  // 右上角淡色装饰块
  slide.addShape(pptx.ShapeType.rect, { x: 10.9, y: 0, w: 2.43, h: 0.18, fill: { color: T.panel }, line: { type: "none" } });

  slide.addText("AI 转型方案 · 四层架构汇报", {
    x: 0.9, y: 1.7, w: 11.5, h: 0.4, fontFace: FONT, fontSize: 13, color: T.accent, bold: true, charSpacing: 2,
  });
  slide.addText(shortText(project.name, 40), {
    x: 0.9, y: 2.25, w: 11.5, h: 1.4, fontFace: FONT, fontSize: 38, color: T.ink, bold: true, lineSpacingMultiple: 1.05,
  });
  slide.addText(`${project.industry}  ·  ${project.scenario}`, {
    x: 0.92, y: 3.7, w: 11.5, h: 0.5, fontFace: FONT, fontSize: 18, color: T.body,
  });

  // 元信息行
  const meta: any[] = [];
  const pushMeta = (k: string, v?: string) => {
    if (!v) return;
    meta.push({ text: k + "  ", options: { color: T.muted, fontSize: 11, bold: true } });
    meta.push({ text: v + "      ", options: { color: T.body, fontSize: 11 } });
  };
  pushMeta("目标用户", project.targetUser);
  pushMeta("输出目的", project.outputPurpose);
  pushMeta("方案深度", project.depth);
  if (meta.length) {
    slide.addShape(pptx.ShapeType.rect, { x: 0.92, y: 4.45, w: 0.4, h: 0.045, fill: { color: T.border }, line: { type: "none" } });
    slide.addText(meta, { x: 0.92, y: 4.65, w: 11.5, h: 0.4, fontFace: FONT });
  }

  const dateStr = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  slide.addText("AI Transformation Canvas", {
    x: 0.9, y: 6.7, w: 7, h: 0.35, fontFace: FONT, fontSize: 11, color: T.muted, bold: true,
  });
  slide.addText(dateStr, {
    x: 6.3, y: 6.7, w: 6.1, h: 0.35, fontFace: FONT, fontSize: 11, color: T.muted, align: "right",
  });
}

function addOverview(pptx: any, project: Project) {
  const slide = pptx.addSlide();
  slide.background = { color: T.white };
  addHeader(pptx, slide, "Overview", "四层架构总览");

  const layers = LAYER_ORDER.map((id) => project.layers.find((l) => l.id === id)).filter(Boolean) as Layer[];

  const cardW = 2.86;
  const gap = 0.18;
  const startX = 0.6;
  const y = 1.75;
  const h = 4.7;

  layers.forEach((layer, i) => {
    const x = startX + i * (cardW + gap);
    // 卡片底板
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w: cardW, h, rectRadius: 0.08,
      fill: { color: T.panelSoft }, line: { color: T.border, width: 1 },
    });
    // 顶部强调条
    slide.addShape(pptx.ShapeType.rect, { x, y, w: cardW, h: 0.12, fill: { color: T.accent }, line: { type: "none" } });
    // 序号徽标
    slide.addText(String(i + 1).padStart(2, "0"), {
      x: x + 0.2, y: y + 0.32, w: 1, h: 0.7, fontFace: FONT, fontSize: 34, color: T.accent, bold: true,
    });
    slide.addText(LAYER_LABEL[layer.id] || layer.title, {
      x: x + 0.2, y: y + 1.15, w: cardW - 0.4, h: 0.4, fontFace: FONT, fontSize: 15, color: T.ink, bold: true,
    });
    slide.addText(shortText(layer.description, 64), {
      x: x + 0.2, y: y + 1.6, w: cardW - 0.4, h: 2.2, fontFace: FONT, fontSize: 10.5, color: T.body,
      valign: "top", lineSpacingMultiple: 1.2,
    });
    slide.addText(`${layer.modules.length} 个模块`, {
      x: x + 0.2, y: y + h - 0.5, w: cardW - 0.4, h: 0.35, fontFace: FONT, fontSize: 10, color: T.accent, bold: true,
    });
  });

  addFooter(slide, project.name, "总览");
}

function addLayerSection(pptx: any, project: Project, layer: Layer, index: number) {
  const slide = pptx.addSlide();
  slide.background = { color: T.white };

  // 左侧大号序号区块
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 3.4, h: 7.5, fill: { color: T.panelSoft }, line: { type: "none" } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.3, h: 7.5, fill: { color: T.accent }, line: { type: "none" } });
  slide.addText(String(index + 1).padStart(2, "0"), {
    x: 0.5, y: 2.5, w: 2.6, h: 1.4, fontFace: FONT, fontSize: 90, color: T.accent, bold: true,
  });
  slide.addText("LAYER", {
    x: 0.55, y: 3.9, w: 2.6, h: 0.4, fontFace: FONT, fontSize: 13, color: T.muted, bold: true, charSpacing: 4,
  });

  // 右侧标题与描述
  slide.addText(LAYER_LABEL[layer.id] || "", {
    x: 3.9, y: 1.5, w: 8.8, h: 0.7, fontFace: FONT, fontSize: 30, color: T.ink, bold: true,
  });
  slide.addText(layer.title, {
    x: 3.92, y: 2.25, w: 8.8, h: 0.6, fontFace: FONT, fontSize: 14, color: T.accent,
  });
  slide.addText(layer.description, {
    x: 3.92, y: 2.95, w: 8.8, h: 0.9, fontFace: FONT, fontSize: 12, color: T.body, valign: "top", lineSpacingMultiple: 1.25,
  });

  // 模块清单（标题 + 摘要）
  const list: any[] = [];
  layer.modules.forEach((m) => {
    list.push({ text: m.title, options: { bold: true, color: T.ink, fontSize: 11, bullet: { code: "25AA", indent: 16 }, breakLine: true, paraSpaceBefore: 4 } });
    list.push({ text: shortText(m.summary, 52), options: { color: T.muted, fontSize: 9.5, breakLine: true, indentLevel: 1 } });
  });
  slide.addText(list, { x: 3.92, y: 4.0, w: 8.8, h: 2.9, fontFace: FONT, valign: "top" });

  addFooter(slide, project.name, LAYER_LABEL[layer.id] || "");
}

function addModuleSlide(pptx: any, project: Project, layer: Layer, m: ModuleItem, idx: number, total: number) {
  const slide = pptx.addSlide();
  slide.background = { color: T.white };

  // 顶部：层级标签（pill）+ 模块计数
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: 0.42, w: 1.5, h: 0.34, rectRadius: 0.17, fill: { color: T.accent }, line: { type: "none" },
  });
  slide.addText(LAYER_LABEL[layer.id] || "", {
    x: 0.6, y: 0.42, w: 1.5, h: 0.34, fontFace: FONT, fontSize: 10, color: T.white, bold: true, align: "center", valign: "middle",
  });
  slide.addText(`模块 ${idx} / ${total}`, {
    x: 10.7, y: 0.44, w: 2.03, h: 0.32, fontFace: FONT, fontSize: 10, color: T.muted, align: "right",
  });

  // 模块标题
  slide.addText(m.title, {
    x: 0.6, y: 0.86, w: 12.1, h: 0.6, fontFace: FONT, fontSize: 24, color: T.ink, bold: true,
  });
  slide.addShape(pptx.ShapeType.rect, { x: 0.62, y: 1.5, w: 0.62, h: 0.06, fill: { color: T.accent }, line: { type: "none" } });

  // ---- 左栏：摘要 + 核心内容 ----
  const leftX = 0.6, leftW = 5.0;
  // 摘要面板
  slide.addShape(pptx.ShapeType.roundRect, {
    x: leftX, y: 1.75, w: leftW, h: 1.35, rectRadius: 0.06, fill: { color: T.panel }, line: { type: "none" },
  });
  slide.addText("摘要", {
    x: leftX + 0.22, y: 1.9, w: leftW - 0.4, h: 0.3, fontFace: FONT, fontSize: 10, color: T.accent, bold: true, charSpacing: 2,
  });
  slide.addText(shortText(m.summary, 120), {
    x: leftX + 0.22, y: 2.2, w: leftW - 0.44, h: 0.82, fontFace: FONT, fontSize: 11, color: T.body, valign: "top", lineSpacingMultiple: 1.2,
  });

  // 核心内容（bullets）
  slide.addText("核心内容", {
    x: leftX, y: 3.35, w: leftW, h: 0.3, fontFace: FONT, fontSize: 11, color: T.ink, bold: true,
  });
  const bullets = (m.bullets || []).slice(0, 6).map((b) => ({
    text: stripInline(b),
    options: { color: T.body, fontSize: 10.5, bullet: { code: "2022", indent: 14 }, breakLine: true, paraSpaceAfter: 3, lineSpacingMultiple: 1.1 },
  }));
  if (bullets.length) {
    slide.addText(bullets, { x: leftX, y: 3.7, w: leftW, h: 3.0, fontFace: FONT, valign: "top" });
  }

  // ---- 右栏：模块详情 ----
  const rightX = 5.95, rightW = 6.78;
  slide.addShape(pptx.ShapeType.rect, { x: rightX - 0.25, y: 1.8, w: 0.03, h: 4.9, fill: { color: T.border }, line: { type: "none" } });
  slide.addText("模块详情", {
    x: rightX, y: 1.75, w: rightW, h: 0.3, fontFace: FONT, fontSize: 11, color: T.ink, bold: true,
  });
  slide.addText(detailToRuns(m.detail), {
    x: rightX, y: 2.12, w: rightW, h: 4.6, fontFace: FONT, valign: "top", autoFit: true,
  });

  addFooter(slide, project.name, LAYER_LABEL[layer.id] || "");
}

function addClosing(pptx: any, project: Project) {
  const slide = pptx.addSlide();
  slide.background = { color: T.white };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 3.3, w: 13.33, h: 0.06, fill: { color: T.accent }, line: { type: "none" } });
  slide.addText("汇报结束 · 谢谢", {
    x: 0, y: 2.4, w: 13.33, h: 0.8, fontFace: FONT, fontSize: 32, color: T.ink, bold: true, align: "center",
  });
  slide.addText("欢迎就四层架构方案展开讨论", {
    x: 0, y: 3.5, w: 13.33, h: 0.5, fontFace: FONT, fontSize: 14, color: T.muted, align: "center",
  });
}

/* ------------------------------------------------------------------ *
 * 构建 PPT（不触发下载），返回 pptx 实例与文件名
 * ------------------------------------------------------------------ */
async function buildPptx(project: Project): Promise<{ pptx: any; fileName: string }> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
  pptx.layout = "WIDE";
  pptx.author = "AI Transformation Canvas";
  pptx.title = project.name;

  addCover(pptx, project);
  addOverview(pptx, project);

  const layers = LAYER_ORDER
    .map((id) => project.layers.find((l) => l.id === id))
    .filter(Boolean) as Layer[];

  layers.forEach((layer, li) => {
    addLayerSection(pptx, project, layer, li);
    const total = layer.modules.length;
    layer.modules.forEach((m, mi) => {
      addModuleSlide(pptx, project, layer, m, mi + 1, total);
    });
  });

  addClosing(pptx, project);

  const safeName = (project.name || "AI方案").replace(/[\\/:*?"<>|]/g, "_");
  return { pptx, fileName: `${safeName}.pptx` };
}

/** 生成 PPT 并返回 Blob 产物（保存起来供用户手动下载，不立即触发下载）。 */
export async function buildProjectPptxBlob(
  project: Project,
): Promise<{ blob: Blob; fileName: string }> {
  const { pptx, fileName } = await buildPptx(project);
  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  return { blob, fileName };
}

/** 把已生成的 PPT Blob 触发为本地下载。 */
export function downloadPptxBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 入口：构建 PPT 并立即触发下载（保留给需要"生成即下载"的场景）。 */
export async function exportProjectToPptx(project: Project): Promise<void> {
  const { blob, fileName } = await buildProjectPptxBlob(project);
  downloadPptxBlob(blob, fileName);
}
