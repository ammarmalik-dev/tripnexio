/**
 * The branded email layout from the client's sample (client testing
 * 2026-10-09, H — `client-message/new-doc-from-client-09-oct`, image 6),
 * restyled per client doc 2026-10-15 (H): a subtle light-blue body around a
 * white card, a dark-navy header with the name in large white text and the tagline (2026-10-27, H1), compact
 * spacing, contacts in an aligned two-column grid that stacks on a phone, a
 * "Follow Us On" row of social icons and a one-line automated-email note. Then the
 * event illustration + heading + status pill, a Booking ID / Service card, the
 * message, a "Need assistance?" block (phone, WhatsApp, email, website),
 * "Best regards, Team TripNexio", social icons and the automated-email strip.
 * No office address. Table-based with inline styles so it renders in
 * Gmail/Outlook; the contact items and the header tagline are inline-blocks so
 * they wrap on a phone instead of squeezing. Images are absolute PNG URLs
 * under /email on the live site (many mail apps don't show SVG).
 */

export type EmailIllustration = "visa" | "flight" | "payment" | "general" | "request" | "quote" | "approved" | "boarding";

export interface EmailHero {
  heading: string;
  /** Short status shown in the green pill (e.g. "Approved"); omitted when null. */
  badge?: string | null;
  illustration: EmailIllustration;
  /** Client corrections 2026-10-05 §9 — flight emails show the airline's logo + name under the heading. */
  airline?: { name: string; logoUrl: string | null } | null;
  /** The Booking ID / Service card (client testing 2026-10-09, H), plus passengers / route / travel date (client 2026-10-14). */
  summary?: { reference: string | null; service: string | null; trip?: { label: string; value: string }[] } | null;
}

export interface EmailSocials {
  instagram: string;
  facebook: string;
  linkedin: string;
  x: string;
  threads: string;
}

export interface EmailLayoutInput {
  /** The template body, already rendered and escaped. */
  bodyHtml: string;
  hero?: EmailHero | null;
  /** Plain text (escaped here) — an Admin-set "Email footer" note; blank = none (the automated-email strip is always shown). */
  footerText: string;
  siteUrl: string;
  companyName: string;
  tagline: string;
  phone: string;
  supportEmail: string;
  whatsappHref: string;
  socials: EmailSocials;
}

const NAVY = "#182A4D";
const BLUE = "#3E6FDB";
const INK = "#111318";
const MUTED = "#5B6478";
const CARD = "#F1F6FE";
/** Client doc 2026-10-15 (H1) — the subtle light-blue page behind the email. */
const PAGE = "#EAF1FC";
const BORDER = "#D9E4F5";
const FONT = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

export function escapeEmailText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Templates written before this layout end with their own "— TripNexio" sign-off;
 * the layout now signs every email "Team TripNexio", so a trailing one is dropped.
 * Client doc 2026-10-27 (H1) — "Best regards, Team TripNexio" still showed twice: a template's own sign-off is
 * often followed by the Pay Now / Download button or the output note, so it is removed wherever it stands on its
 * own lines, not only at the very end. The layout then signs once, after the message, before "Need assistance?".
 */
export function stripTrailingSignature(bodyHtml: string, companyName: string): string {
  const name = companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const gap = "(?:<br\\s*/?>|\\s)*";
  const signOff = new RegExp(
    `${gap}(?:(?:best|warm|kind|thanks\\s*(?:&amp;|&|and))\\s+)?regards,?${gap}(?:(?:the\\s+)?team\\s+)?${name}(?:\\s+(?:team|support))?\\.?(?=${gap}(?:<|$))`,
    "gi"
  );
  return bodyHtml
    .replace(signOff, "")
    .replace(new RegExp(`${gap}(?:—|–|-{1,2})\\s*(?:Team\\s+)?${name}\\.?${gap}$`, "i"), "")
    .replace(/(?:<br\s*\/?>|\s)+$/i, "");
}

/** A bulletproof (table-based, Outlook-safe) button — "Pay Now", "Download"… (client 2026-10-14: buttons, not bare links). */
export function emailButtonHtml(label: string, url: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:14px 0"><tr><td style="border-radius:10px;background:${BLUE}"><a href="${escapeEmailText(url)}" style="${FONT}display:inline-block;padding:12px 28px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px">${escapeEmailText(label)}</a></td></tr></table>`;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function renderEmailLayout(input: EmailLayoutInput): string {
  const site = input.siteUrl.replace(/\/$/, "");
  const esc = escapeEmailText;
  const phoneHref = input.phone.replace(/[^\d+]/g, "");
  const siteLabel = site.replace(/^https?:\/\//, "");
  const footer = input.footerText.trim() ? esc(input.footerText.trim()).replace(/\r?\n/g, "<br>") : "";
  const body = stripTrailingSignature(input.bodyHtml, input.companyName);
  const divider = `<tr><td style="padding:16px 0 0"><div style="border-top:1px solid ${BORDER};font-size:0;line-height:0">&nbsp;</div></td></tr>`;

  const hero = input.hero
    ? `<tr><td align="center" style="padding:18px 12px 0">
        <img src="${site}/email/hero-${input.hero.illustration}.png" width="190" alt="" style="display:block;width:190px;max-width:60%;height:auto;border:0">
        <h1 style="${FONT}margin:10px 0 0;font-size:22px;line-height:1.3;color:${INK};font-weight:700">${esc(input.hero.heading)}</h1>
        ${
          input.hero.badge
            ? `<span style="${FONT}display:inline-block;margin-top:10px;padding:6px 18px;border-radius:999px;background:#DFF5E6;color:#14783A;font-size:14px;font-weight:700">${esc(input.hero.badge)}</span>`
            : ""
        }
        ${
          input.hero.airline
            ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:12px auto 0"><tr>${
                input.hero.airline.logoUrl && /^https:\/\//.test(input.hero.airline.logoUrl)
                  ? `<td valign="middle" style="padding-right:8px"><img src="${esc(input.hero.airline.logoUrl)}" width="28" height="28" alt="" style="display:block;width:28px;height:28px;border:0;border-radius:6px"></td>`
                  : ""
              }<td valign="middle" style="${FONT}font-size:14px;font-weight:600;color:${INK}">${esc(input.hero.airline.name)}</td></tr></table>`
            : ""
        }
      </td></tr>`
    : "";

  const summary = input.hero?.summary && (input.hero.summary.reference || input.hero.summary.service) ? input.hero.summary : null;
  const summaryCard = summary
    ? `<tr><td style="padding:16px 0 0">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${CARD};border-radius:14px">
          <tr>
            <td width="88" valign="middle" align="center" style="padding:18px 0 18px 18px"><img src="${site}/email/ic-doc.png" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border:0"></td>
            <td valign="middle" style="${FONT}padding:16px 20px;border-left:1px solid ${BORDER}">
              ${summary.reference ? `<p style="margin:0;font-size:13px;color:${MUTED}">Booking ID</p><p style="margin:2px 0 0;font-size:20px;font-weight:700;color:${BLUE}">${esc(summary.reference)}</p>` : ""}
              ${summary.service ? `<p style="margin:${summary.reference ? "10px" : "0"} 0 0;font-size:13px;color:${MUTED}">Service</p><p style="margin:2px 0 0;font-size:16px;color:${INK}">${esc(summary.service)}</p>` : ""}
              ${(summary.trip ?? [])
                .map((fact) => `<p style="margin:10px 0 0;font-size:13px;color:${MUTED}">${esc(fact.label)}</p><p style="margin:2px 0 0;font-size:16px;color:${INK}">${esc(fact.value)}</p>`)
                .join("")}
            </td>
          </tr>
        </table>
      </td></tr>`
    : "";

  // Client doc 2026-10-15 (H2) — equal-width cells, icon + text left-aligned, two per row (one per row on a phone).
  const contactItem = (icon: string, label: string, href: string) =>
    `<div style="display:inline-block;vertical-align:top;width:48%;min-width:220px;margin:4px 0;text-align:left"><a href="${esc(href)}" style="${FONT}display:block;color:${INK};text-decoration:none;font-size:13px;line-height:28px;white-space:nowrap"><img src="${site}/email/${icon}.png" width="28" height="28" alt="" style="display:inline-block;vertical-align:middle;width:28px;height:28px;border:0;margin-right:8px">${esc(label)}</a></div>`;
  const contacts = [
    contactItem("ic-phone", input.phone, `tel:${phoneHref}`),
    isHttpUrl(input.whatsappHref) ? contactItem("ic-whatsapp", "WhatsApp Support", input.whatsappHref) : "",
    contactItem("ic-mail", input.supportEmail, `mailto:${input.supportEmail}`),
    contactItem("ic-web", siteLabel, site),
  ].join("");

  const socialLinks = (
    [
      ["instagram", "Instagram", input.socials.instagram],
      ["facebook", "Facebook", input.socials.facebook],
      ["linkedin", "LinkedIn", input.socials.linkedin],
      ["x", "X", input.socials.x],
      ["threads", "Threads", input.socials.threads],
    ] as const
  )
    .filter(([, , url]) => isHttpUrl(url))
    .map(
      ([key, label, url]) =>
        `<a href="${esc(url)}" title="${label}" style="display:inline-block;margin:0 6px;text-decoration:none"><img src="${site}/email/so-${key}.png" width="32" height="32" alt="${label}" style="display:block;width:32px;height:32px;border:0"></a>`
    )
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(input.companyName)}</title></head>
<body style="margin:0;padding:0;background:${PAGE}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PAGE}"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden">
  <tr><td align="center" style="background:${NAVY};padding:26px 18px">
    <!-- Client doc 2026-10-27 (H1): the name as large bold white text with the tagline under it, centred (HTML text, so it shows with images off). -->
    <p style="${FONT}margin:0;font-size:34px;line-height:1.2;font-weight:700;color:#FFFFFF">${esc(input.companyName)}</p>
    ${input.tagline.trim() ? `<p style="${FONT}margin:6px 0 0;font-size:16px;line-height:1.4;color:#DCE6F7">${esc(input.tagline)}</p>` : ""}
  </td></tr>
  <tr><td style="padding:0 20px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
  ${hero}
  ${summaryCard}
  <tr><td style="${FONT}padding:18px 2px 0;color:${INK};font-size:15px;line-height:1.6">${body}</td></tr>
  <tr><td style="${FONT}padding:16px 2px 0;color:${INK}">
    <p style="margin:0;font-size:15px;color:${MUTED}">Best regards,</p>
    <p style="margin:2px 0 0;font-size:18px;font-weight:700;color:${NAVY}">Team ${esc(input.companyName)}</p>
  </td></tr>
  ${divider}
  <tr><td style="padding:16px 0 0">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${CARD};border-radius:14px">
      <tr><td style="padding:16px 16px 4px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
          <td width="70" valign="middle"><img src="${site}/email/ic-support.png" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border:0"></td>
          <td valign="middle" style="${FONT}padding-left:16px;border-left:1px solid ${BORDER}">
            <p style="margin:0;font-size:19px;font-weight:700;color:${NAVY}">Need assistance?</p>
            <p style="margin:4px 0 0;font-size:14px;line-height:1.5;color:${MUTED}">Have a question or need help? Our support team is here to assist you.</p>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:6px 16px 12px">${contacts}</td></tr>
    </table>
  </td></tr>
  </table>
  </td></tr>
  ${
    socialLinks
      ? `<tr><td align="center" style="${FONT}padding:18px 12px 0"><p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.3px;color:${NAVY}">Follow Us On</p>${socialLinks}</td></tr>`
      : ""
  }
  <tr><td align="center" style="${FONT}padding:14px 12px 0;font-size:12px;line-height:1.4;color:${MUTED}">This is an automated email. Please do not reply to this message.</td></tr>
  ${footer ? `<tr><td align="center" style="${FONT}padding:8px 16px 0;font-size:12px;line-height:1.5;color:${MUTED}">${footer}</td></tr>` : ""}
  <tr><td style="padding:0 0 16px"></td></tr>
</table>
</td></tr></table>
</body></html>`;
}
