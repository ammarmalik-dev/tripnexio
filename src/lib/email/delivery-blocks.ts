import { EMAIL_PALETTE } from "./layout";
import { escapeHtml } from "../html/escape";

/**
 * Client doc 16 Nov (M2) — the ticket / visa / package delivery emails: the Important Information heading in its
 * own (serif) style, the disclaimer in a separate, highlighted box, and the opening line set apart from the body.
 * Email clients don't share CSS, so everything is inline.
 */

const HEADING_FONT = "font-family:Georgia,'Times New Roman',serif;";
const BODY_FONT = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
/** Warm amber for the disclaimer box (an email has no design tokens; kept beside the brand palette). */
const DISCLAIMER_BG = "#FFF7E6";
const DISCLAIMER_BORDER = "#E8A23A";
const DISCLAIMER_TEXT = "#5C3D0E";

export interface ImportantInfo {
  title: string;
  lines: string[];
  closing: string;
}

/** Splits the block's lines into the information lines and the disclaimer lines. */
export function splitDisclaimer(lines: string[]): { info: string[]; disclaimer: string[] } {
  const info: string[] = [];
  const disclaimer: string[] = [];
  let inDisclaimer = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const label = trimmed.includes(":") ? trimmed.slice(0, trimmed.indexOf(":")) : "";
    if (/disclaimer/i.test(label)) {
      // A bare "Disclaimer:" header starts a section that runs to the end; "X Disclaimer: text" is one line.
      const rest = trimmed.slice(trimmed.indexOf(":") + 1).trim();
      if (rest) disclaimer.push(rest);
      inDisclaimer = !rest;
      continue;
    }
    (inDisclaimer ? disclaimer : info).push(trimmed);
  }
  return { info, disclaimer };
}

function infoLineHtml(line: string): string {
  // "Airport Reporting: Arrive…" → the label in bold, the rest normal.
  const match = /^([^:]{2,40}):\s+(.+)$/.exec(line);
  const content = match ? `<strong style="color:${EMAIL_PALETTE.NAVY}">${escapeHtml(match[1])}:</strong> ${escapeHtml(match[2])}` : escapeHtml(line);
  return `<p style="${BODY_FONT}margin:0 0 8px;font-size:14px;line-height:1.55;color:${EMAIL_PALETTE.INK}">${content}</p>`;
}

/** The disclaimer box on its own (also used for the general discrepancy note). */
export function disclaimerHtml(lines: string[]): string {
  if (lines.length === 0) return "";
  return `<div style="margin-top:14px;padding:12px 16px;border-left:4px solid ${DISCLAIMER_BORDER};border-radius:8px;background:${DISCLAIMER_BG}"><p style="${HEADING_FONT}margin:0 0 6px;font-size:15px;font-weight:700;letter-spacing:.3px;color:${DISCLAIMER_TEXT}">Disclaimer</p>${lines
    .map((line) => `<p style="${BODY_FONT}margin:0 0 4px;font-size:13px;font-style:italic;line-height:1.5;color:${DISCLAIMER_TEXT}">${escapeHtml(line)}</p>`)
    .join("")}</div>`;
}

/** The Important Information block: serif heading with an underline rule, labelled lines, then the disclaimer box. */
export function importantInfoHtml(block: ImportantInfo): string {
  const { info, disclaimer } = splitDisclaimer(block.lines);
  return `<div style="margin-top:20px;padding:16px 18px;border-radius:12px;background:${EMAIL_PALETTE.CARD};border:1px solid ${EMAIL_PALETTE.BORDER}"><p style="${HEADING_FONT}margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid ${EMAIL_PALETTE.BLUE};font-size:18px;font-weight:700;color:${EMAIL_PALETTE.NAVY}">${escapeHtml(block.title)}</p>${info
    .map(infoLineHtml)
    .join("")}${disclaimerHtml(disclaimer)}<p style="${BODY_FONT}margin:14px 0 0;font-size:14px;font-weight:700;color:${EMAIL_PALETTE.NAVY}">${escapeHtml(block.closing)}</p></div>`;
}

/** Status-template / legacy events whose email delivers a ticket, visa, package, reservation or OTB approval. */
export const DELIVERY_EVENT_PATTERN = /VISA_APPROVED|PARTIAL_APPROVAL|EXT_14|EXT_15|PACKAGE_GENERATED|TICKET_ISSUED|RESERVATION_ISSUED|^SF_15$|OUTPUT_DELIVERED|OTB_APPROVED/;

const GREETING = /^(hi|hello|dear)\b/i;
/** "Important Travel Instructions:" — a heading on its own line (nothing after the colon). */
const SECTION_HEADING = /^(?:⚠️\s*)?important[^:<]{0,60}:\s*$/i;

/**
 * The email's opening line (the first sentence after the "Hi Name," greeting) set apart: larger, navy, semi-bold.
 * `bodyHtml` is the rendered body with `<br>` line breaks; everything else is returned unchanged.
 */
export function withOpeningLine(bodyHtml: string): string {
  const lines = bodyHtml.split("<br>");
  let index = lines.findIndex((line) => line.trim() !== "");
  if (index !== -1 && GREETING.test(lines[index].trim())) {
    index = lines.findIndex((line, at) => at > index && line.trim() !== "");
  }
  if (index === -1 || lines[index].trim().startsWith("<")) return bodyHtml;
  lines[index] = `<span style="${BODY_FONT}display:block;margin:2px 0 4px;font-size:17px;font-weight:600;line-height:1.45;color:${EMAIL_PALETTE.NAVY}">${lines[index].trim()}</span>`;
  return lines.join("<br>");
}

/**
 * The client's template text already carries "Important Travel Instructions:" sections, "Important: …" notes and
 * "Disclaimer: …" paragraphs as plain lines — this turns each paragraph (lines between blank lines) into its styled
 * block: a section heading → the Important Information card; a "Disclaimer" paragraph → the disclaimer box; an
 * "Important: …" note → a highlighted note. Other paragraphs are left as they are. Input and output are body HTML
 * with `<br>` line breaks (already escaped).
 */
export function styleBodySections(bodyHtml: string): string {
  const paragraphs = bodyHtml.split(/(?:<br>\s*){2,}/);
  const styled = paragraphs.map((paragraph): { html: string; block: boolean } => {
      const plain = { html: paragraph, block: false };
      const lines = paragraph.split("<br>").map((line) => line.trim()).filter(Boolean);
      const first = lines[0] ?? "";
      if (first.startsWith("<")) return plain;
      if (SECTION_HEADING.test(first)) {
        return { block: true, html: `<div style="margin:14px 0;padding:14px 16px;border-radius:12px;background:${EMAIL_PALETTE.CARD};border:1px solid ${EMAIL_PALETTE.BORDER}"><p style="${HEADING_FONT}margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid ${EMAIL_PALETTE.BLUE};font-size:17px;font-weight:700;color:${EMAIL_PALETTE.NAVY}">${first.replace(/:\s*$/, "")}</p>${lines
          .slice(1)
          .map((line) => `<p style="${BODY_FONT}margin:0 0 6px;font-size:14px;line-height:1.55;color:${EMAIL_PALETTE.INK}">${line}</p>`)
          .join("")}</div>` };
      }
      if (/^disclaimer\s*:/i.test(first)) {
        const rest = [first.replace(/^disclaimer\s*:\s*/i, ""), ...lines.slice(1)].filter(Boolean);
        return { block: true, html: `<div style="margin:14px 0;padding:12px 16px;border-left:4px solid ${DISCLAIMER_BORDER};border-radius:8px;background:${DISCLAIMER_BG}"><p style="${HEADING_FONT}margin:0 0 6px;font-size:15px;font-weight:700;letter-spacing:.3px;color:${DISCLAIMER_TEXT}">Disclaimer</p>${rest
          .map((line) => `<p style="${BODY_FONT}margin:0 0 4px;font-size:13px;font-style:italic;line-height:1.5;color:${DISCLAIMER_TEXT}">${line}</p>`)
          .join("")}</div>` };
      }
      if (/^important\s*:/i.test(first)) {
        const text = [first.replace(/^important\s*:\s*/i, ""), ...lines.slice(1)].join("<br>");
        return { block: true, html: `<p style="${BODY_FONT}margin:14px 0;padding:10px 14px;border-left:4px solid ${EMAIL_PALETTE.BLUE};border-radius:8px;background:${EMAIL_PALETTE.CARD};font-size:14px;line-height:1.55;color:${EMAIL_PALETTE.INK}"><strong style="${HEADING_FONT}color:${EMAIL_PALETTE.NAVY}">Important:</strong> ${text}</p>` };
      }
      return plain;
    });
  // Plain paragraphs keep their blank line between them; a styled block brings its own margin.
  return styled.map((part, index) => (index > 0 && !part.block && !styled[index - 1].block ? `<br><br>${part.html}` : part.html)).join("");
}

/** A delivery email body: sections styled, then the opening line set apart. */
export function formatDeliveryBody(bodyHtml: string): string {
  return withOpeningLine(styleBodySections(bodyHtml));
}
