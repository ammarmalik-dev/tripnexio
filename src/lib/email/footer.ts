/**
 * The disclaimer at the bottom of every email the system sends (client
 * request 2026-10-03: emails come from a no-reply address, so tell the
 * reader where to go instead). Text from Admin → System Configuration
 * ("Email footer"); blank = DEFAULT below with the support phone filled in.
 */
export const SUPPORT_EMAIL = "support@tripnexio.com";

export function defaultEmailFooter(supportPhone: string): string {
  return (
    "This is an automatically generated email. Please do not reply to this message. " +
    `For any queries, feedback or suggestions, please contact our support team at ${SUPPORT_EMAIL} or call ${supportPhone}.`
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Appends the footer as plain, escaped text below a divider. Empty footer = html unchanged. */
export function appendEmailFooter(html: string, footer: string): string {
  const text = footer.trim();
  if (!text) return html;
  const body = escapeHtml(text).replace(/\r?\n/g, "<br>");
  return (
    `${html}` +
    `<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 14px">` +
    `<p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5">${body}</p>`
  );
}
