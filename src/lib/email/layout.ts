/**
 * The branded email layout from the client's sample (client testing
 * 2026-10-09, H — `client-message/new-doc-from-client-09-oct`, image 6):
 * a white header with the symbol, "TripNexio" and the tagline on one line, the
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
  /** The Booking ID / Service card (client testing 2026-10-09, H). */
  summary?: { reference: string | null; service: string | null } | null;
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
const BORDER = "#D9E4F5";
const FONT = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

export function escapeEmailText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Templates written before this layout end with their own "— TripNexio" sign-off;
 * the layout now signs every email "Team TripNexio", so a trailing one is dropped.
 */
export function stripTrailingSignature(bodyHtml: string, companyName: string): string {
  const name = companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return bodyHtml.replace(new RegExp(`(?:<br\\s*/?>|\\s)*(?:—|–|-{1,2})\\s*(?:Team\\s+)?${name}\\.?(?:<br\\s*/?>|\\s)*$`, "i"), "");
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
  const divider = `<tr><td style="padding:22px 0 0"><div style="border-top:1px solid ${BORDER};font-size:0;line-height:0">&nbsp;</div></td></tr>`;

  const hero = input.hero
    ? `<tr><td align="center" style="padding:22px 12px 0">
        <img src="${site}/email/hero-${input.hero.illustration}.png" width="220" alt="" style="display:block;width:220px;max-width:70%;height:auto;border:0">
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
    ? `<tr><td style="padding:20px 0 0">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${CARD};border-radius:14px">
          <tr>
            <td width="88" valign="middle" align="center" style="padding:18px 0 18px 18px"><img src="${site}/email/ic-doc.png" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border:0"></td>
            <td valign="middle" style="${FONT}padding:16px 20px;border-left:1px solid ${BORDER}">
              ${summary.reference ? `<p style="margin:0;font-size:13px;color:${MUTED}">Booking ID</p><p style="margin:2px 0 0;font-size:20px;font-weight:700;color:${BLUE}">${esc(summary.reference)}</p>` : ""}
              ${summary.service ? `<p style="margin:${summary.reference ? "10px" : "0"} 0 0;font-size:13px;color:${MUTED}">Service</p><p style="margin:2px 0 0;font-size:16px;color:${INK}">${esc(summary.service)}</p>` : ""}
            </td>
          </tr>
        </table>
      </td></tr>`
    : "";

  const contactItem = (icon: string, label: string, href: string) =>
    `<div style="display:inline-block;vertical-align:middle;margin:6px 8px;white-space:nowrap"><a href="${esc(href)}" style="${FONT}color:${INK};text-decoration:none;font-size:13px"><img src="${site}/email/${icon}.png" width="30" height="30" alt="" style="display:inline-block;vertical-align:middle;width:30px;height:30px;border:0;margin-right:6px">${esc(label)}</a></div>`;
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
        `<a href="${esc(url)}" style="display:inline-block;margin:0 7px;text-decoration:none"><img src="${site}/email/so-${key}.png" width="34" height="34" alt="${label}" style="display:block;width:34px;height:34px;border:0"></a>`
    )
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(input.companyName)}</title></head>
<body style="margin:0;padding:0;background:#FFFFFF">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFFFFF"><tr><td align="center" style="padding:12px 10px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px">
  <tr><td align="center" style="padding:14px 0 18px;border-bottom:1px solid ${BORDER}">
    <div style="display:inline-block;vertical-align:middle;margin:4px 0">
      <table role="presentation" cellspacing="0" cellpadding="0"><tr>
        <td valign="middle" style="padding-right:12px"><img src="${site}/email/logo-symbol.png" width="40" height="40" alt="" style="display:block;width:40px;height:40px;border:0"></td>
        <td valign="middle" style="${FONT}padding-left:12px;border-left:1px solid ${BORDER};font-size:28px;font-weight:700;letter-spacing:-0.5px;color:${NAVY};white-space:nowrap">Trip<span style="color:${BLUE}">Nexio</span></td>
      </tr></table>
    </div>
    <div style="${FONT}display:inline-block;vertical-align:middle;margin:4px 0 4px 14px;padding-left:14px;border-left:1px solid ${BORDER};font-size:15px;font-weight:600;color:#55627A">${esc(input.tagline)}</div>
  </td></tr>
  ${hero}
  ${summaryCard}
  <tr><td style="${FONT}padding:22px 6px 0;color:${INK};font-size:15px;line-height:1.65">${body}</td></tr>
  ${divider}
  <tr><td style="padding:20px 0 0">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${CARD};border-radius:14px">
      <tr><td style="padding:18px 18px 6px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
          <td width="70" valign="middle"><img src="${site}/email/ic-support.png" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border:0"></td>
          <td valign="middle" style="${FONT}padding-left:16px;border-left:1px solid ${BORDER}">
            <p style="margin:0;font-size:19px;font-weight:700;color:${NAVY}">Need assistance?</p>
            <p style="margin:4px 0 0;font-size:14px;line-height:1.5;color:${MUTED}">Have a question or need help? Our support team is here to assist you.</p>
          </td>
        </tr></table>
      </td></tr>
      <tr><td align="center" style="padding:6px 8px 14px">${contacts}</td></tr>
    </table>
  </td></tr>
  ${divider}
  <tr><td style="${FONT}padding:20px 6px 0;color:${INK}">
    <p style="margin:0;font-size:15px;color:${MUTED}">Best regards,</p>
    <p style="margin:2px 0 0;font-size:18px;font-weight:700;color:${NAVY}">Team ${esc(input.companyName)}</p>
  </td></tr>
  ${socialLinks ? `<tr><td align="center" style="padding:20px 0 0">${socialLinks}</td></tr>` : ""}
  <tr><td style="padding:22px 0 0">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFF4EA;border-radius:14px">
      <tr>
        <td width="74" valign="middle" align="center" style="padding:14px 0 14px 14px"><img src="${site}/email/ic-automated.png" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border:0"></td>
        <td valign="middle" style="${FONT}padding:14px 18px;font-size:14px;line-height:1.5;color:${MUTED}">This is an automated email. Please do not reply to this message.</td>
      </tr>
    </table>
  </td></tr>
  ${footer ? `<tr><td align="center" style="${FONT}padding:12px 16px 0;font-size:12px;line-height:1.55;color:${MUTED}">${footer}</td></tr>` : ""}
  <tr><td style="padding:0 0 16px"></td></tr>
</table>
</td></tr></table>
</body></html>`;
}
