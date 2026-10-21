import { OUTPUT_TYPE_LABELS, type OutputType } from "../outputs/output-types";

const CODE_LABELS: Record<string, string> = {
  PASSPORT: "Passport",
  VISA_COPY: "Visa Copy",
  PHOTO: "Photograph",
  ONWARD_TICKET: "Onward Ticket",
  RETURN_TICKET: "Return Ticket",
  BANK_SLIP: "Bank Transfer Slip",
};

/**
 * Live check 2026-10-21 — some upload paths (WhatsApp bot, quote page, delivered outputs) store a code
 * ("VISA_COPY", "TICKET_PDF") as Document.type; show it as words. Admin-named documents pass through.
 */
export function documentTypeLabel(type: string): string {
  if (type in OUTPUT_TYPE_LABELS) return OUTPUT_TYPE_LABELS[type as OutputType];
  if (CODE_LABELS[type]) return CODE_LABELS[type];
  if (/^[A-Z0-9_]+$/.test(type)) return type.toLowerCase().split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  return type;
}
