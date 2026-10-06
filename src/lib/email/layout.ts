/**
 * Client corrections 2026-10-05 — the branded email layout from the client's
 * sample (client-message/new-doc-from-client): navy header with the logo and
 * tagline, an illustration + heading + status pill, the message in a white
 * card, a "Need Assistance?" card, a contact row, the no-reply footer text,
 * the office address and a copyright line. Table-based with inline styles so
 * it renders in Gmail/Outlook. Images are absolute URLs under /email on the
 * live site (PNG — many mail apps don't show SVG).
 */

export type EmailIllustration = "visa" | "flight" | "payment" | "general";

export interface EmailHero {
  heading: string;
  /** Short status shown in the green pill (e.g. "Approved"); omitted when null. */
  badge?: string | null;
  illustration: EmailIllustration;
  /** Client corrections 2026-10-05 §9 — flight emails show the airline's logo + name under the heading. */
  airline?: { name: string; logoUrl: string | null } | null;
}

export interface EmailLayoutInput {
  /** The template body, already rendered and escaped. */
  bodyHtml: string;
  hero?: EmailHero | null;
  /** Plain text (escaped here) — the Admin "Email footer" disclaimer. */
  footerText: string;
  siteUrl: string;
  companyName: string;
  tagline: string;
  phone: string;
  supportEmail: string;
  address: string;
}

const NAVY = "#182A4D";
const BLUE = "#3E6FDB";
const INK = "#111318";
const MUTED = "#5B6478";
const BG = "#F2F6FD";
const BORDER = "#DCE5F5";
const FONT = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

export function escapeEmailText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function renderEmailLayout(input: EmailLayoutInput): string {
  const site = input.siteUrl.replace(/\/$/, "");
  const esc = escapeEmailText;
  const phoneHref = input.phone.replace(/[^\d+]/g, "");
  const siteLabel = site.replace(/^https?:\/\//, "");
  const footer = input.footerText.trim() ? esc(input.footerText.trim()).replace(/\r?\n/g, "<br>") : "";

  const hero = input.hero
    ? `<tr><td align="center" style="padding:28px 24px 8px">
        <img src="${site}/email/hero-${input.hero.illustration}.png" width="220" alt="" style="display:block;width:220px;max-width:70%;height:auto;border:0">
        <h1 style="${FONT}margin:14px 0 0;font-size:24px;line-height:1.3;color:${INK};font-weight:700">${esc(input.hero.heading)}</h1>
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

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(input.companyName)}</title></head>
<body style="margin:0;padding:0;background:#FFFFFF">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFFFFF"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;border-collapse:separate">
  <tr><td style="background:${NAVY};padding:22px 28px;border-radius:14px 14px 0 0">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
      <td valign="middle">
        <img src="${site}/email/logo-white.png" width="170" alt="${esc(input.companyName)}" style="display:block;width:170px;height:auto;border:0;margin-left:-12px">
        <p style="${FONT}margin:4px 0 0;color:#FFFFFF;font-size:14px;font-weight:600">${esc(input.tagline)}</p>
      </td>
      <td valign="middle" align="right" style="${FONT}color:#FFFFFF;font-size:16px;font-weight:700;line-height:1.2">Explore<br><span style="color:#8FB0F5">the World</span></td>
    </tr></table>
  </td></tr>
  <tr><td style="background:${BG};padding:0 20px 20px;border-radius:0 0 14px 14px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      ${hero}
      <tr><td style="padding-top:${input.hero ? "18px" : "22px"}">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border:1px solid ${BORDER};border-radius:12px">
          <tr><td style="${FONT}padding:24px 26px;color:${INK};font-size:15px;line-height:1.65">${input.bodyHtml}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding-top:16px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border:1px solid ${BORDER};border-radius:12px">
          <tr>
            <td width="84" valign="middle" align="center" style="padding:18px 0 18px 18px"><img src="${site}/email/support.png" width="64" alt="" style="display:block;width:64px;height:auto;border:0"></td>
            <td valign="middle" style="${FONT}padding:18px 22px;border-left:1px solid ${BORDER}">
              <p style="margin:0;font-size:17px;font-weight:700;color:${INK}">Need Assistance?</p>
              <p style="margin:4px 0 0;font-size:14px;line-height:1.55;color:${MUTED}">If you have any questions or need help with your request, reach out to your dedicated POC or our support team at <a href="mailto:${esc(input.supportEmail)}" style="color:${BLUE};text-decoration:none;font-weight:600">${esc(input.supportEmail)}</a>.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="${FONT}padding:18px 12px 6px;font-size:14px;color:${INK}">
    <a href="tel:${esc(phoneHref)}" style="color:${INK};text-decoration:none">&#9742;&nbsp;${esc(input.phone)}</a>
    <span style="color:${BORDER};padding:0 10px">|</span>
    <a href="mailto:${esc(input.supportEmail)}" style="color:${INK};text-decoration:none">&#9993;&nbsp;${esc(input.supportEmail)}</a>
    <span style="color:${BORDER};padding:0 10px">|</span>
    <a href="${site}" style="color:${INK};text-decoration:none">&#127760;&nbsp;${esc(siteLabel)}</a>
  </td></tr>
  <tr><td style="padding:10px 24px 0"><div style="border-top:1px solid ${BORDER}"></div></td></tr>
  ${footer ? `<tr><td align="center" style="${FONT}padding:12px 28px 0;font-size:12px;line-height:1.55;color:${MUTED}">${footer}</td></tr>` : ""}
  ${input.address ? `<tr><td align="center" style="${FONT}padding:8px 28px 0;font-size:12px;color:${MUTED}">${esc(input.address)}</td></tr>` : ""}
  <tr><td align="center" style="${FONT}padding:8px 28px 18px;font-size:12px;color:${MUTED}">&copy; ${new Date().getFullYear()} ${esc(input.companyName)}. All Rights Reserved.</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
