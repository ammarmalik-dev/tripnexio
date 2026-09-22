/**
 * The real notification-event catalog — replaces the "the real event
 * catalog doesn't exist yet" note on the NotificationTemplate model (Phase
 * 4D). Every key here is an `event` value an Admin can create an EMAIL
 * NotificationTemplate for at /admin/notification-templates, and every one
 * is actually triggered somewhere in the app — see CLAUDE.md's "Transactional
 * Email (Resend)" and "n8n Automation" sections for exactly where.
 * QUOTE_REMINDER/PAYMENT_REMINDER/LEAD_FOLLOWUP are triggered by the n8n
 * background workflows (Phase 5E), not a request/webhook — the earlier "no
 * cron/scheduler in this app" gap is what that phase closes.
 *
 * `variables` documents the {{placeholder}} names each trigger site fills
 * in — kept here (not just in code comments at each call site) so the
 * Admin template editor and the "Send Test" preview can both list them.
 */
export const NOTIFICATION_EVENTS = {
  LEAD_RECEIVED: "LEAD_RECEIVED",
  QUOTE_READY: "QUOTE_READY",
  QUOTE_REMINDER: "QUOTE_REMINDER",
  QUOTE_EXPIRED: "QUOTE_EXPIRED",
  PAYMENT_RECEIVED: "PAYMENT_RECEIVED",
  PAYMENT_REMINDER: "PAYMENT_REMINDER",
  DOCUMENTS_REQUIRED: "DOCUMENTS_REQUIRED",
  DOCUMENT_APPROVED: "DOCUMENT_APPROVED",
  DOCUMENT_REJECTED: "DOCUMENT_REJECTED",
  LEAD_FOLLOWUP: "LEAD_FOLLOWUP",
} as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

export const NOTIFICATION_EVENT_CATALOG: {
  event: NotificationEvent;
  label: string;
  variables: string[];
  /** Every event is wired now (Phase 5E closed the "no scheduler" gap) — kept for the Admin template editor / Send Test UI, which reads this to build sample previews. */
  wired: boolean;
  sampleVariables: Record<string, string>;
}[] = [
  {
    event: NOTIFICATION_EVENTS.LEAD_RECEIVED,
    label: "Request received",
    variables: ["customerName", "serviceType", "leadReference"],
    wired: true,
    sampleVariables: { customerName: "Sample Customer", serviceType: "New Visa", leadReference: "NV-SAMPLE" },
  },
  {
    event: NOTIFICATION_EVENTS.QUOTE_READY,
    label: "Quote ready",
    variables: ["customerName", "leadReference", "sellingPrice", "quoteValidUntil", "reviewLink"],
    wired: true,
    sampleVariables: {
      customerName: "Sample Customer",
      leadReference: "NV-SAMPLE",
      sellingPrice: "Rs. 25,000.00",
      quoteValidUntil: "7 Sept 2026, 6:30 pm",
      reviewLink: "https://tripnexio.com/quote/sample-token",
    },
  },
  {
    event: NOTIFICATION_EVENTS.QUOTE_REMINDER,
    label: "Quote expiring soon (reminder)",
    variables: ["customerName", "leadReference"],
    wired: true,
    sampleVariables: { customerName: "Sample Customer", leadReference: "NV-SAMPLE" },
  },
  {
    event: NOTIFICATION_EVENTS.QUOTE_EXPIRED,
    label: "Quote expired",
    variables: ["customerName", "leadReference"],
    wired: true,
    sampleVariables: { customerName: "Sample Customer", leadReference: "NV-SAMPLE" },
  },
  {
    event: NOTIFICATION_EVENTS.PAYMENT_RECEIVED,
    label: "Payment received",
    variables: ["customerName", "bookingId", "leadReference", "amount"],
    wired: true,
    sampleVariables: { customerName: "Sample Customer", bookingId: "TNX-OT-SAMPLE", leadReference: "OT-SAMPLE", amount: "Rs. 1,605.00" },
  },
  {
    event: NOTIFICATION_EVENTS.PAYMENT_REMINDER,
    label: "Payment pending (reminder)",
    variables: ["customerName", "bookingId", "leadReference", "amount"],
    wired: true,
    sampleVariables: { customerName: "Sample Customer", bookingId: "TNX-OT-SAMPLE", leadReference: "OT-SAMPLE", amount: "Rs. 1,605.00" },
  },
  {
    event: NOTIFICATION_EVENTS.DOCUMENTS_REQUIRED,
    label: "Document(s) required",
    variables: ["customerName", "documentName", "leadReference"],
    wired: true,
    sampleVariables: { customerName: "Sample Customer", documentName: "PASSPORT", leadReference: "NV-SAMPLE" },
  },
  {
    event: NOTIFICATION_EVENTS.DOCUMENT_APPROVED,
    label: "Document approved",
    variables: ["customerName", "documentName", "leadReference"],
    wired: true,
    sampleVariables: { customerName: "Sample Customer", documentName: "PASSPORT", leadReference: "NV-SAMPLE" },
  },
  {
    event: NOTIFICATION_EVENTS.DOCUMENT_REJECTED,
    label: "Document rejected",
    variables: ["customerName", "documentName", "leadReference"],
    wired: true,
    sampleVariables: { customerName: "Sample Customer", documentName: "PASSPORT", leadReference: "NV-SAMPLE" },
  },
  {
    event: NOTIFICATION_EVENTS.LEAD_FOLLOWUP,
    label: "Lead follow-up (periodic nudge)",
    variables: ["customerName", "serviceType", "leadReference"],
    wired: true,
    sampleVariables: { customerName: "Sample Customer", serviceType: "New Visa", leadReference: "NV-SAMPLE" },
  },
];
