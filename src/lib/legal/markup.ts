/**
 * The small text format used for About/legal page bodies (Admin → Legal
 * Pages). Client-safe: the Admin preview and the public pages render the
 * same parse. Nothing here produces HTML strings — the renderer turns these
 * blocks into React elements, so typed text can never inject markup.
 *
 *   ## Heading            section heading
 *   (blank line)          starts a new paragraph
 *   - item                bullet list (consecutive lines)
 *   **bold**              bold text
 *   [text](/path)         link (https://, mailto:, tel: or a /site path)
 *   {{token}}             a paragraph that is exactly a token is filled in by the page
 *
 * Extra blank lines and spaces are ignored, so pasted text never shows gaps.
 */
export type LegalBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "token"; name: string };

const TOKEN_LINE = /^\{\{\s*([a-zA-Z]+)\s*\}\}$/;

function clean(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

export function parseLegalMarkup(body: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = clean(paragraph.join(" "));
    paragraph = [];
    if (!text) return;
    const token = TOKEN_LINE.exec(text);
    blocks.push(token ? { type: "token", name: token[1] } : { type: "paragraph", text });
  };
  const flushList = () => {
    if (list.length > 0) blocks.push({ type: "list", items: list });
    list = [];
  };

  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (line === "") {
      flushParagraph();
      flushList();
    } else if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      const text = clean(line.slice(3));
      if (text) blocks.push({ type: "heading", text });
    } else if (/^[-*•]\s+/.test(line)) {
      flushParagraph();
      const item = clean(line.replace(/^[-*•]\s+/, ""));
      if (item) list.push(item);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

export type InlinePart = { type: "text"; text: string } | { type: "bold"; text: string } | { type: "link"; text: string; href: string };

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Only these link targets are rendered as links; anything else stays plain text. */
export function isSafeHref(href: string): boolean {
  return /^(https:\/\/|mailto:|tel:|\/(?!\/))/i.test(href);
}

export function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ type: "text", text: text.slice(last, index) });
    if (match[1] !== undefined) parts.push({ type: "bold", text: match[1] });
    else if (isSafeHref(match[3])) parts.push({ type: "link", text: match[2], href: match[3] });
    else parts.push({ type: "text", text: match[0] });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}
