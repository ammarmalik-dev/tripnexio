import { leadListFacts } from "./list-facts";
import { db } from "../db";
import type { Prisma, ServiceType } from "../../generated/prisma/client";
import { findOrCreateCustomer, type LeadContact } from "./create-lead";
import { ABANDONED_DRAFT_SOURCE, findOpenDraftLead } from "./abandoned-draft";
import { getInitialServiceStatusId } from "../service-status/engine";
import { writeAudit } from "../audit/log";

export interface DraftLeadResult {
  leadId: string;
  /** "created" on the visitor's first Next, "updated" when the same draft is refreshed. */
  outcome: "created" | "updated";
}

/**
 * Creates or refreshes ONE abandoned-form draft Lead per (customer,
 * serviceType) — see abandoned-draft.ts for the full lifecycle. Reuses the
 * same Customer matching as createLeadFromSubmission (mobile first, then
 * email). No Passenger rows (step 1 only identifies the contact, not the
 * travellers), no customer token, and — deliberately — NO customer
 * notification: a draft is not a submitted request.
 */
export async function createOrRefreshDraftLead(serviceType: ServiceType, contact: LeadContact): Promise<DraftLeadResult> {
  return db.$transaction(async (tx) => {
    const customer = await findOrCreateCustomer(tx, contact);
    const draftDetails = {
      abandonedDraft: true,
      draftContact: { fullName: contact.fullName, mobile: contact.mobile, email: contact.email },
      draftCapturedAt: new Date().toISOString(),
      passengerIds: [],
    } satisfies Prisma.InputJsonObject;

    const existing = await findOpenDraftLead(tx, customer.id, serviceType);
    if (existing) {
      // Refreshed silently (no audit row per "Next" click) — the CREATE row already records the draft.
      await tx.lead.update({ where: { id: existing.id }, data: { details: draftDetails, ...(await leadListFacts(tx, draftDetails)) } });
      return { leadId: existing.id, outcome: "updated" as const };
    }

    const lead = await tx.lead.create({
      data: {
        customerId: customer.id,
        serviceType,
        source: ABANDONED_DRAFT_SOURCE,
        // Client doc 2026-10-15 (C2) — a draft takes no lead number: it gets one only when the form is
        // submitted (createLeadFromSubmission), so abandoned forms never leave gaps in the sequence.
        serviceStatusId: await getInitialServiceStatusId(tx, serviceType, "LEAD"),
        details: draftDetails,
        ...(await leadListFacts(tx, draftDetails)),
      },
    });
    await writeAudit(tx, {
      entityType: "Lead",
      entityId: lead.id,
      action: "DRAFT_CREATE",
      note: `${serviceType} abandoned-form draft captured at step 1 for customer ${customer.id} (full form not yet submitted)`,
    });
    return { leadId: lead.id, outcome: "created" as const };
  });
}
