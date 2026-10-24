import type { Prisma, ServiceType } from "../../generated/prisma/client";
import { ABANDONED_DRAFT_SOURCE } from "../leads/abandoned-draft";

/** The quote-review services — a full-form submission waits for staff to build a quotation. */
export const AWAITING_QUOTE_SERVICES = ["FLIGHT_SPECIAL_FARE", "VISA_EXTENSION", "VISA_CHANGE"] as const satisfies readonly ServiceType[];

/**
 * P21 — a lead in the "Awaiting quotation" queue: a quote-review service, no quotation yet, not
 * Converted / Lost / Closed, and not an abandoned step-1 draft. Shared by the queue and the Leads list
 * (Dashboard doc §7: such a request goes to Quotations instead of Leads).
 */
export const AWAITING_QUOTATION_WHERE: Prisma.LeadWhereInput = {
  AND: [
    { serviceType: { in: [...AWAITING_QUOTE_SERVICES] } },
    { status: { notIn: ["CONVERTED", "LOST", "CLOSED"] } },
    { quotations: { none: {} } },
    // `source` is nullable — a plain `not` would also drop NULL-source leads.
    { OR: [{ source: null }, { source: { not: ABANDONED_DRAFT_SOURCE } }] },
  ],
};
