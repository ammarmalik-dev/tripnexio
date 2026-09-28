const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes a value for safe interpolation into HTML text or a quoted attribute. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

const ALLOWED_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a"]);

/**
 * Reduces staff-composed email HTML to a small set of basic formatting tags.
 * Every other tag is removed (its text kept), all attributes are dropped
 * except an http(s)/mailto `href` on <a>, and script/style blocks are removed
 * with their content.
 */
export function sanitizeBasicHtml(html: string): string {
  const withoutBlocks = html.replace(/<(script|style|iframe|object|embed|noscript)\b[\s\S]*?<\/\1\s*>/gi, "");
  return withoutBlocks.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, rawTag: string, attributes: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (match.startsWith("</")) return `</${tag}>`;
    if (tag === "a") {
      const href = /\bhref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attributes);
      const url = href ? (href[2] ?? href[3] ?? "").trim() : "";
      return /^(https?:|mailto:)/i.test(url) ? `<a href="${escapeHtml(url)}" rel="noopener noreferrer">` : "<a>";
    }
    return `<${tag}>`;
  });
}
