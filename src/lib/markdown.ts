/**
 * Minimal, safe Markdown parser for briefs and step guides. Produces a small
 * AST that React renders — no HTML strings, so nothing can be injected.
 * Supports: # ## ### headings, paragraphs, - / * / 1. lists, **bold**,
 * *italic*, `code`, [text](https://link) and bare https:// links.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; children: Inline[] }
  | { type: "paragraph"; lines: Inline[][] }
  | { type: "list"; ordered: boolean; items: Inline[][] };

export function isSafeHref(href: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(href.trim());
}

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))|(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  while (rest.length > 0) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push({ type: "text", text: rest });
      break;
    }
    if (m.index > 0) out.push({ type: "text", text: rest.slice(0, m.index) });
    const token = m[0];
    if (m[1]) out.push({ type: "code", text: token.slice(1, -1) });
    else if (m[2]) out.push({ type: "strong", children: parseInline(token.slice(2, -2)) });
    else if (m[3]) out.push({ type: "em", children: parseInline(token.slice(1, -1)) });
    else if (m[4]) {
      const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)!;
      if (isSafeHref(href!)) out.push({ type: "link", href: href!, children: parseInline(label!) });
      else out.push({ type: "text", text: label! });
    } else out.push({ type: "link", href: token, children: [{ type: "text", text: token }] });
    rest = rest.slice(m.index + token.length);
  }
  return out;
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let para: Inline[][] = [];
  let list: { ordered: boolean; items: Inline[][] } | null = null;

  const flush = () => {
    if (para.length) blocks.push({ type: "paragraph", lines: para });
    if (list) blocks.push({ type: "list", ...list });
    para = [];
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: "heading", level: heading[1]!.length as 1 | 2 | 3, children: parseInline(heading[2]!) });
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (para.length) {
        blocks.push({ type: "paragraph", lines: para });
        para = [];
      }
      if (list && list.ordered !== ordered) {
        blocks.push({ type: "list", ...list });
        list = null;
      }
      list ??= { ordered, items: [] };
      list.items.push(parseInline((bullet ?? numbered)![1]!));
      continue;
    }
    if (list) {
      blocks.push({ type: "list", ...list });
      list = null;
    }
    para.push(parseInline(line.trim()));
  }
  flush();
  return blocks;
}
