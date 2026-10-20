import { siteConfig } from "../site-config";

/**
 * Client 2026-10-14 — "Replace payment links with a clear Pay Now / Download
 * button across all services". The events whose message carries a link, and
 * the button that link becomes: an email button, a WhatsApp session message
 * with a tappable button, and the URL button of the Meta template
 * (Meta URL `https://tripnexio.com/{{1}}`, see `ctaUrlSuffix`).
 */
export const EVENT_CTA: Record<string, { variable: string; label: string }> = {
  PAYMENT_LINK_READY: { variable: "paymentLink", label: "Pay Now" },
  QUOTE_READY: { variable: "reviewLink", label: "View & Pay" },
  OUTPUT_DELIVERED: { variable: "downloadLink", label: "Download" },
  DOCUMENTS_REQUIRED: { variable: "uploadLink", label: "Upload Documents" },
};

/**
 * The message's button when its link variable is filled in, else null. A template's own button
 * (client doc 2026-10-20: NotificationTemplate.ctaLabel + ctaLink) wins over the event default.
 */
export function ctaFor(
  event: string,
  variables: Record<string, string>,
  template?: { ctaLabel?: string | null; ctaLink?: string | null } | null
): { label: string; url: string; variable: string } | null {
  const own = template?.ctaLabel?.trim() && template.ctaLink?.trim() ? { label: template.ctaLabel.trim(), variable: template.ctaLink.trim() } : null;
  const cta = own ?? EVENT_CTA[event];
  const url = cta ? variables[cta.variable]?.trim() : "";
  return cta && url && /^https?:\/\//i.test(url) ? { label: cta.label, url, variable: cta.variable } : null;
}

/** The part after the site root, for a Meta template URL button whose URL is `https://tripnexio.com/{{1}}`; null for another host. */
export function ctaUrlSuffix(url: string): string | null {
  const root = `${siteConfig.url.replace(/\/$/, "")}/`;
  return url.startsWith(root) ? url.slice(root.length) : null;
}

/**
 * The template text without the link placeholder, for a channel that shows the
 * link as a button instead: "… here: {{paymentLink}} (…)" reads "… (…)".
 */
export function withoutLinkPlaceholder(text: string, variable: string): string {
  return text
    .replace(new RegExp(`[^\\S\\n]*(?:here|link)?:?[^\\S\\n]*\\{\\{\\s*${variable}\\s*\\}\\}`, "gi"), "")
    .replace(/[^\S\n]{2,}/g, " ")
    .replace(/[^\S\n]+([.,)])/g, "$1")
    .trim();
}
