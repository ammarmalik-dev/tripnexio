/**
 * Step 56, CRM.md §25 — the exact 10 draft types the locked spec names.
 * Kept as a flat enum-like union (not a Prisma enum) since drafting is
 * ephemeral — nothing about a draft is ever persisted, only the resulting
 * send is (via the existing EMAIL_SENT/WHATSAPP_SENT AuditTrail rows).
 */
export const DRAFT_TYPES = [
  "STATUS_UPDATE",
  "DOCUMENT_REQUEST",
  "PAYMENT_REMINDER",
  "QUOTATION_MESSAGE",
  "FOLLOW_UP",
  "REFUND_UPDATE",
  "CANCELLATION_MESSAGE",
  "VISA_UPDATE",
  "TICKET_UPDATE",
  "ADDITIONAL_INFO_REQUEST",
] as const;

export type DraftType = (typeof DRAFT_TYPES)[number];

export const DRAFT_TYPE_LABELS: Record<DraftType, string> = {
  STATUS_UPDATE: "Status Update",
  DOCUMENT_REQUEST: "Document Request",
  PAYMENT_REMINDER: "Payment Reminder",
  QUOTATION_MESSAGE: "Quotation Message",
  FOLLOW_UP: "Follow-up",
  REFUND_UPDATE: "Refund Update",
  CANCELLATION_MESSAGE: "Cancellation Message",
  VISA_UPDATE: "Visa Update",
  TICKET_UPDATE: "Ticket Update",
  ADDITIONAL_INFO_REQUEST: "Additional Information Request",
};

export const DRAFT_TYPE_OPTIONS: { value: DraftType; label: string }[] = DRAFT_TYPES.map((value) => ({
  value,
  label: DRAFT_TYPE_LABELS[value],
}));

/** The angle/purpose each draft type should take — an instruction for the AI system prompt, not customer-facing text. See DRAFT_TYPE_OPENER for the template fallback's actual message wording. */
export const DRAFT_TYPE_PURPOSE: Record<DraftType, string> = {
  STATUS_UPDATE: "Give the customer a clear, friendly update on the current status of their request.",
  DOCUMENT_REQUEST: "Ask the customer to submit the specific outstanding documents listed in the record data.",
  PAYMENT_REMINDER: "Remind the customer about a pending payment and how to complete it.",
  QUOTATION_MESSAGE: "Present the quotation/pricing details from the record data and invite the customer to accept it.",
  FOLLOW_UP: "Check in on a request that's been quiet for a while and offer to help move it forward.",
  REFUND_UPDATE: "Update the customer on the status and amount of their refund.",
  CANCELLATION_MESSAGE: "Inform the customer their booking/request has been cancelled, and any next steps.",
  VISA_UPDATE: "Update the customer on the current status of their visa processing.",
  TICKET_UPDATE: "Update the customer on their flight ticket or booking details.",
  ADDITIONAL_INFO_REQUEST: "Ask the customer for specific additional information needed to proceed with their request.",
};

/** Ready-to-send, second-person opening line per draft type — used by the template fallback (unlike DRAFT_TYPE_PURPOSE, this is actual customer-facing message text, not an instruction). */
export const DRAFT_TYPE_OPENER: Record<DraftType, string> = {
  STATUS_UPDATE: "Here's a quick update on your request:",
  DOCUMENT_REQUEST: "We still need a couple of documents from you to keep things moving:",
  PAYMENT_REMINDER: "Just a reminder that a payment is still pending on your request:",
  QUOTATION_MESSAGE: "Here are the details of your quotation:",
  FOLLOW_UP: "We wanted to check in on your request, since it's been a little quiet:",
  REFUND_UPDATE: "Here's an update on your refund:",
  CANCELLATION_MESSAGE: "We're writing to let you know about a cancellation on your request:",
  VISA_UPDATE: "Here's an update on your visa processing:",
  TICKET_UPDATE: "Here's an update on your ticket/booking:",
  ADDITIONAL_INFO_REQUEST: "We need a bit more information from you to proceed:",
};
