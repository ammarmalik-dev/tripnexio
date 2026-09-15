/**
 * Step 27 (audit §4.4) — the fixed, enumerable set of read-only query
 * types the Admin AI Command Center can answer, per ADMIN.md §10/§41's
 * example questions. Deliberately a closed set, not free-form SQL
 * generation or arbitrary tool access — the AI's only job is picking one
 * of these and extracting its parameter; the actual query logic lives in
 * src/lib/admin-ai/handlers.ts and is 100% hand-written, auditable code.
 *
 * Every type here is a READ. Mutating commands (create a FAQ, disable a
 * service, change a price — all named in ADMIN.md §10/§41) are explicitly
 * out of scope for this step per the roadmap prompt; NOT_AVAILABLE is what
 * the classifier picks for those today, with a message saying so rather
 * than attempting or faking them. `riskLevel` is on every type now so a
 * future mutating type can declare "mutate-low"/"mutate-high" and the
 * execution pipeline can require confirmation for those without changing
 * this file's shape — see route.ts's own doc comment for the pipeline.
 */
export const COMMAND_TYPES = {
  PENDING_REFUNDS: {
    description: "List refunds currently pending approval. No parameters.",
    riskLevel: "read",
  },
  FAILED_AUTOMATIONS_TODAY: {
    description: "List n8n automation job runs that failed today. No parameters.",
    riskLevel: "read",
  },
  INTEGRATION_HEALTH: {
    description:
      "Report connection health (configured vs mock, last success, last error) for Payment Gateway, Email, WhatsApp, and OCR, plus n8n automation status. Matches questions like 'check WhatsApp', 'check n8n', 'check OCR', 'show failed tools'. No parameters.",
    riskLevel: "read",
  },
  STAFF_WORKLOAD: {
    description: "Show every active staff member's current PAX-based workload (open bookings + total PAX). No parameters.",
    riskLevel: "read",
  },
  BOOKING_DIAGNOSIS: {
    description:
      "Explain the current state of ONE specific booking or lead — status, age, payment status, missing documents, recent activity. Requires a `reference` parameter: the booking id (e.g. TNX-OT-058517) or lead reference (e.g. OTB-058517) mentioned in the question. Matches 'why is booking X stuck', 'why is this booking delayed'.",
    riskLevel: "read",
    requiresParam: "reference",
  },
  CUSTOMER_BOOKINGS: {
    description:
      "List all bookings for one customer. Requires a `customer` parameter: the customer's name or mobile number mentioned in the question.",
    riskLevel: "read",
    requiresParam: "customer",
  },
  POC_BOOKINGS: {
    description:
      "List open bookings currently handled by one staff member (their point-of-contact workload). Requires a `staffName` parameter: the staff member's name mentioned in the question. Matches 'show me all bookings handled by this POC'.",
    riskLevel: "read",
    requiresParam: "staffName",
  },
  TODAY_PAYMENTS_SUMMARY: {
    description:
      "Summarize today's successfully collected payments and their margin. Matches 'show today's P&L' — note this is a payments/margin summary, NOT a full profit & loss statement (operating costs aren't tracked in this platform). No parameters.",
    riskLevel: "read",
  },
  TODAY_CONFIG_CHANGES: {
    description: "List today's changes to pricing/config masters (tax/fee rates, coupons, pricing rules). Matches 'show today's price changes'. No parameters.",
    riskLevel: "read",
  },
  SERVICE_FUNNEL: {
    description:
      "Show lead-status and quotation-conversion counts for one service, to spot the biggest drop-off point. Requires a `serviceType` parameter: the service name mentioned (e.g. 'New Visa', 'OTB', 'Flight Special Fare'). Matches 'why are customers not purchasing this service', 'why are customers abandoning this quotation'.",
    riskLevel: "read",
    requiresParam: "serviceType",
  },
  NOT_AVAILABLE: {
    description:
      "Use this for anything not covered above: website/visitor analytics, Meta/Google ad tracking, TAT/SLA records, vendor-recommendation reasoning (there is no automated vendor recommendation — every vendor choice is staff-entered), or ANY action that would create/modify/disable something (mutating actions aren't available in this version yet).",
    riskLevel: "read",
  },
} as const;

export type CommandTypeKey = keyof typeof COMMAND_TYPES;

export const COMMAND_TYPE_KEYS = Object.keys(COMMAND_TYPES) as CommandTypeKey[];
