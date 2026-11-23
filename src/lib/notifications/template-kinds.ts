/**
 * Client doc 16 Nov (M4) — what kind of message a template is, for the Notification Templates filters and the
 * "reminder management" view. Pure (unit-tested).
 */
export type TemplateKind = "SUBMISSION" | "PAYMENT" | "DOCUMENTS" | "REMINDER" | "UPSELL" | "COUPON" | "STATUS" | "GENERAL";

export const TEMPLATE_KIND_OPTIONS: { value: TemplateKind; label: string }[] = [
  { value: "SUBMISSION", label: "Submission (request received)" },
  { value: "PAYMENT", label: "Payment & quotation" },
  { value: "DOCUMENTS", label: "Documents" },
  { value: "REMINDER", label: "Reminders & follow-ups" },
  { value: "UPSELL", label: "Upsell offers" },
  { value: "COUPON", label: "Coupon offers" },
  { value: "STATUS", label: "Status updates" },
  { value: "GENERAL", label: "General / system" },
];

const REMINDERS = new Set(["PAYMENT_REMINDER", "QUOTE_REMINDER", "DOCUMENT_REMINDER", "VISA_EXTENSION_REMINDER", "LEAD_FOLLOWUP"]);

export interface TemplateUsage {
  statuses: { event: string; name: string; scope: string; stage: "BEFORE_PAYMENT" | "AFTER_PAYMENT" }[];
}

export function templateKindFor(event: string, usage: TemplateUsage): TemplateKind {
  if (REMINDERS.has(event)) return "REMINDER";
  if (event.endsWith("_UPSELL")) return "UPSELL";
  if (event.includes("COUPON")) return "COUPON";
  const statuses = usage.statuses.filter((status) => status.event === event);
  if (event === "LEAD_RECEIVED" || statuses.some((status) => status.scope === "LEAD" && /^new$/i.test(status.name))) return "SUBMISSION";
  if (/PAY|QUOTE|QUOTATION/.test(event) || statuses.some((status) => /payment|quotation|paid/i.test(status.name))) return "PAYMENT";
  if (/DOC/.test(event) || statuses.some((status) => /document/i.test(status.name))) return "DOCUMENTS";
  if (statuses.length > 0 || /^(SERVICE_STATUS_UPDATE|OUTPUT_DELIVERED|OTB_APPROVED)$/.test(event)) return "STATUS";
  return "GENERAL";
}

/** Before / after payment, from the statuses that send it (null when it isn't tied to a status). */
export function templateStageFor(event: string, usage: TemplateUsage): "BEFORE_PAYMENT" | "AFTER_PAYMENT" | "BOTH" | null {
  const stages = new Set(usage.statuses.filter((status) => status.event === event).map((status) => status.stage));
  if (stages.size === 0) return null;
  return stages.size > 1 ? "BOTH" : [...stages][0];
}
