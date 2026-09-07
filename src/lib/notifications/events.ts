/**
 * The real notification-event catalog — replaces the "the real event
 * catalog doesn't exist yet" note on the NotificationTemplate model (Phase
 * 4D). Every key here is an `event` value an Admin can create an EMAIL
 * NotificationTemplate for at /admin/notification-templates, and every one
 * except QUOTE_REMINDER is actually triggered somewhere in the app — see
 * CLAUDE.md's "Transactional Email (Resend)" section for exactly where.
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
  DOCUMENTS_REQUIRED: "DOCUMENTS_REQUIRED",
  DOCUMENT_APPROVED: "DOCUMENT_APPROVED",
  DOCUMENT_REJECTED: "DOCUMENT_REJECTED",
} as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

export const NOTIFICATION_EVENT_CATALOG: {
  event: NotificationEvent;
  label: string;
  variables: string[];
  /** false only for QUOTE_REMINDER — seeded so the template exists, but nothing triggers it yet (no cron/scheduler in this app — see CLAUDE.md). */
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
    variables: ["customerName", "leadReference", "sellingPrice", "quoteValidUntil"],
    wired: true,
    sampleVariables: {
      customerName: "Sample Customer",
      leadReference: "NV-SAMPLE",
      sellingPrice: "Rs. 25,000.00",
      quoteValidUntil: "7 Sept 2026, 6:30 pm",
    },
  },
  {
    event: NOTIFICATION_EVENTS.QUOTE_REMINDER,
    label: "Quote reminder (not yet triggered — no scheduler)",
    variables: ["customerName", "leadReference"],
    wired: false,
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
];
