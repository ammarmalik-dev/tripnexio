import type { Prisma, ServiceType } from "../../generated/prisma/client";

/**
 * Abandoned-form drafts (P21). When a visitor completes a service form's
 * contact step, POST /api/leads/draft creates (or refreshes) ONE draft Lead
 * per (customer, serviceType) so an abandoned form is still a lead staff can
 * call. No schema fields — a draft is marked by:
 *  - `Lead.source === ABANDONED_DRAFT_SOURCE`, and
 *  - `details.abandonedDraft === true`.
 * When the same customer then submits the full form,
 * createLeadFromSubmission() takes the draft over (same Lead row, same
 * reference): details are replaced by the real submission, `source` becomes
 * the real source, and `details.abandonedDraft` is cleared — so staff never
 * see a draft + a full lead side by side.
 */
export const ABANDONED_DRAFT_SOURCE = "Abandoned form (step 1)";

/** A draft that has been cancelled/lost/closed by staff (or converted) is never reused. */
const TERMINAL_STATUSES = ["CONVERTED", "LOST", "CLOSED"] as const;

/** The still-open abandoned draft for this customer + service, if any (newest first). */
export async function findOpenDraftLead(tx: Prisma.TransactionClient, customerId: string, serviceType: ServiceType) {
  return tx.lead.findFirst({
    where: {
      customerId,
      serviceType,
      source: ABANDONED_DRAFT_SOURCE,
      details: { path: ["abandonedDraft"], equals: true },
      status: { notIn: [...TERMINAL_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** For UI/list consumers: true when a lead's `details` JSON marks it as an abandoned step-1 draft. */
export function isAbandonedDraftDetails(details: unknown): boolean {
  return typeof details === "object" && details !== null && (details as Record<string, unknown>).abandonedDraft === true;
}
