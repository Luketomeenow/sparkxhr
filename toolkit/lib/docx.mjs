// Word (.docx) export. Takes a simple block list, so the same builder serves
// the browser (blocks read from the edited document) and scripts (blocks read
// from Markdown).
//
// Block shapes:
//   { type: 'heading', level: 1|2|3, runs }
//   { type: 'paragraph', runs }
//   { type: 'list', ordered: bool, items: [{ level, runs }] }
//   { type: 'table', header: [runs], rows: [[runs]] }
//   { type: 'hr' }
// runs: [{ text, bold?, italic?, break? }]
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, Packer, PageNumber,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';
import { lexer } from 'marked';

const NAVY = '1B2559';
const GOLD = 'B8892E';
const MUTED = '6B7280';
const FONT = 'Calibri';

// ---------- Markdown -> blocks (used by scripts) ----------
function inlineRuns(tokens = [], style = {}) {
  const runs = [];
  for (const t of tokens) {
    if (t.type === 'strong') runs.push(...inlineRuns(t.tokens, { ...style, bold: true }));
    else if (t.type === 'em') runs.push(...inlineRuns(t.tokens, { ...style, italic: true }));
    else if (t.type === 'br') runs.push({ text: '', break: true });
    else if (t.tokens) runs.push(...inlineRuns(t.tokens, style));
    else runs.push({ ...style, text: decode(t.text ?? t.raw ?? '') });
  }
  return runs;
}

function decode(s) {
  return String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function listItems(list, level = 0) {
  const items = [];
  for (const item of list.items) {
    const own = [];
    const nested = [];
    for (const t of item.tokens) {
      if (t.type === 'list') nested.push(t);
      else if (t.type === 'text' || t.type === 'paragraph') own.push(...inlineRuns(t.tokens ?? [{ type: 'text', text: t.text }]));
    }
    items.push({ level, runs: own });
    for (const n of nested) items.push(...listItems(n, level + 1));
  }
  return items;
}

export function markdownToBlocks(markdown) {
  const blocks = [];
  for (const t of lexer(markdown, { gfm: true, breaks: true })) {
    if (t.type === 'heading') blocks.push({ type: 'heading', level: Math.min(t.depth, 3), runs: inlineRuns(t.tokens) });
    else if (t.type === 'paragraph') blocks.push({ type: 'paragraph', runs: inlineRuns(t.tokens) });
    else if (t.type === 'list') blocks.push({ type: 'list', ordered: t.ordered, items: listItems(t) });
    else if (t.type === 'table') blocks.push({
      type: 'table',
      header: t.header.map((c) => inlineRuns(c.tokens)),
      rows: t.rows.map((r) => r.map((c) => inlineRuns(c.tokens))),
    });
    else if (t.type === 'hr') blocks.push({ type: 'hr' });
    else if (t.type === 'blockquote') blocks.push({ type: 'paragraph', runs: inlineRuns(t.tokens?.flatMap((x) => x.tokens ?? []), { italic: true }) });
  }
  return blocks;
}

// ---------- blocks -> docx ----------
function textRuns(runs = [], base = {}) {
  const out = [];
  for (const r of runs) {
    if (r.break) { out.push(new TextRun({ text: '', break: 1 })); continue; }
    if (!r.text) continue;
    out.push(new TextRun({
      text: r.text, bold: Boolean(r.bold || base.bold), italics: Boolean(r.italic || base.italic),
      color: base.color, size: base.size, font: FONT,
    }));
  }
  return out.length ? out : [new TextRun({ text: '', font: FONT })];
}

function cell(runs, header) {
  return new TableCell({
    children: [new Paragraph({ children: textRuns(runs, header ? { bold: true, color: 'FFFFFF', size: 18 } : { size: 19 }), spacing: { before: 40, after: 40 } })],
    shading: header ? { type: ShadingType.CLEAR, color: 'auto', fill: NAVY } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}

function table(block) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'D5D5D5' };
  const rows = [
    new TableRow({ tableHeader: true, children: block.header.map((h) => cell(h, true)) }),
    ...block.rows.map((r) => new TableRow({ children: r.map((c) => cell(c, false)) })),
  ];
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
  });
}

function blockToDocx(block, isFirstHeading) {
  switch (block.type) {
    case 'heading': {
      const level = block.level;
      const size = level === 1 ? 40 : level === 2 ? 26 : 23;
      return [new Paragraph({
        heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
        children: textRuns(block.runs, { bold: true, color: NAVY, size }),
        spacing: { before: level === 1 ? 0 : 280, after: level === 1 ? 80 : 100 },
        border: level === 2 ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 2 } } : undefined,
        pageBreakBefore: level === 1 && !isFirstHeading,
      })];
    }
    case 'paragraph':
      return [new Paragraph({ children: textRuns(block.runs, { size: 21 }), spacing: { after: 120, line: 290 } })];
    case 'list':
      return block.items.map((it, i) => new Paragraph({
        children: block.ordered ? [new TextRun({ text: `${i + 1}. `, font: FONT, size: 21 }), ...textRuns(it.runs, { size: 21 })] : textRuns(it.runs, { size: 21 }),
        bullet: block.ordered ? undefined : { level: Math.min(it.level ?? 0, 3) },
        indent: block.ordered ? { left: 360 } : undefined,
        spacing: { after: 60, line: 280 },
      }));
    case 'table':
      return [table(block), new Paragraph({ children: [], spacing: { after: 120 } })];
    case 'hr':
      return [new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D5D5D5', space: 1 } } })];
    default:
      return [];
  }
}

export async function buildDocx(blocks, { title = 'SPARKXHR draft' } = {}) {
  const children = [];
  let seenHeading = false;
  for (const b of blocks) {
    const first = b.type === 'heading' && b.level === 1 && !seenHeading;
    if (b.type === 'heading' && b.level === 1) seenHeading = true;
    children.push(...blockToDocx(b, first || !(b.type === 'heading' && b.level === 1)));
  }
  const doc = new Document({
    title,
    creator: 'SPARKXHR Toolkit',
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections: [{
      properties: { page: { margin: { top: 1200, bottom: 1100, left: 1200, right: 1200 } } },
      headers: {
        default: new Header({ children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'SPARKXHR  ·  Faith & Possibilities HR Consulting', font: FONT, size: 16, color: MUTED })],
        })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ children: ['Draft for review  ·  Page ', PageNumber.CURRENT], font: FONT, size: 16, color: MUTED })],
        })] }),
      },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}

// Basic shape check for blocks arriving from the browser.
export function validBlocks(blocks) {
  if (!Array.isArray(blocks) || blocks.length > 2000) return false;
  const okRuns = (runs) => Array.isArray(runs) && runs.length <= 500 && runs.every((r) => r && typeof r === 'object' && (r.break || typeof r.text === 'string'));
  return blocks.every((b) => {
    if (!b || typeof b !== 'object') return false;
    if (b.type === 'heading' || b.type === 'paragraph') return okRuns(b.runs);
    if (b.type === 'list') return Array.isArray(b.items) && b.items.every((i) => okRuns(i.runs));
    if (b.type === 'table') return Array.isArray(b.header) && b.header.every(okRuns) && Array.isArray(b.rows) && b.rows.every((r) => Array.isArray(r) && r.every(okRuns));
    return b.type === 'hr';
  });
}
