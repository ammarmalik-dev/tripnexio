import type { Prisma } from "../../generated/prisma/client";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { bookingIdForLead } from "./reference";
import { getInitialServiceStatusId } from "../service-status/engine";
import { isExpiredNow } from "../quotations/sync-expiry";
import { getProtectionPlanOffer, leadDestinationCountryCode, protectionPlanRowsForBooking } from "../protection-plan/country-offer";
import { buildDocumentChecklistSnapshot } from "./document-checklist-snapshot";
import { generateToken } from "../quotations/select-quotation";
import { findOriginalBookingForExtension } from "../leads/visa-extension-eligibility";
import { notifyNewBooking } from "../staff-notifications/triggers";

export interface CreateBookingActor {
  byUserId?: string;
  /** e.g. "by Sample Admin" or "by the customer" — appended to every audit note this writes. */
  label: string;
}

export type CreateBookingResult =
  | { ok: true; booking: { id: string; customerToken: string | null } }
  | { ok: false; status: 404 | 409; error: string };

/**
 * Creates a Booking (+ per-passenger rows, Protection Plan offers, document
 * checklist snapshot) from a selected quotation — every precondition the
 * staff route already enforced (quotation selected & not expired, no other
 * active booking on the lead). Shared by the staff CRM route
 * (POST /api/bookings) and the customer review page's approve action.
 *
 * Every booking now gets its own `customerToken` (not just the
 * pay-right-after-the-form services) — a staff-created booking is then just
 * as shareable as a customer-initiated one, via /pay/<token>.
 */
export async function createBookingFromQuotation(
  quotationId: string,
  actor: CreateBookingActor
): Promise<CreateBookingResult> {
  const quotation = await db.quotation.findUnique({ where: { id: quotationId }, include: { lead: true } });
  if (!quotation) return { ok: false, status: 404, error: "Quotation not found." };
  // P22 — a draft can never be booked (and so never paid): send it first.
  if (quotation.isDraft) {
    return { ok: false, status: 409, error: "This quotation is still a draft — send it to the customer first." };
  }
  if (!quotation.isSelected) {
    return { ok: false, status: 409, error: "Select this quotation before booking it." };
  }
  if (isExpiredNow(quotation)) {
    return { ok: false, status: 409, error: "This quotation has expired." };
  }

  const existingActiveBooking = await db.booking.findFirst({
    where: { leadId: quotation.leadId, status: { not: "CANCELLED" } },
  });
  if (existingActiveBooking) {
    return { ok: false, status: 409, error: "This lead already has an active booking." };
  }

  // Every Lead always has at least one passenger (createLeadFromSubmission
  // defaults to one derived from the contact's own name when the service
  // doesn't collect a real passenger list) — see create-lead.ts.
  const leadDetails = (quotation.lead.details ?? {}) as Record<string, unknown>;
  const passengerIds = Array.isArray(leadDetails.passengerIds) ? (leadDetails.passengerIds as string[]) : [];

  // New_Visa.md §8: "Protection Plan is offered after processing selection
  // and before payment" — the earliest point a Booking (and fixed passenger
  // list) exists. New Visa only, and (P12) only where Admin enabled it for
  // the destination country.
  const protectionPlanOffer = await getProtectionPlanOffer(leadDestinationCountryCode(quotation.lead.serviceType, quotation.lead.details));

  const snapshotPassengers =
    passengerIds.length > 0
      ? await db.passenger.findMany({
          where: { id: { in: passengerIds } },
          select: { id: true, fullName: true, nationality: true, nationalityId: true, paxType: true },
        })
      : [];

  // Step 41 — New Visa's lead stores its destination country as a code
  // string in `details.destinationCountry` (see computeNewVisaPrice's own
  // lookup); resolved here so the frozen checklist snapshot can match
  // country-scoped DocumentRequirement rows, not just nationality/paxType
  // ones. No other service currently has a cleanly resolvable destination
  // country in its lead details, so this stays New-Visa-only for now.
  const destinationCountryCode =
    quotation.lead.serviceType === "NEW_VISA" && typeof leadDetails.destinationCountry === "string"
      ? leadDetails.destinationCountry
      : null;
  const destinationCountry = destinationCountryCode ? await db.country.findUnique({ where: { code: destinationCountryCode } }) : null;

  const documentChecklistSnapshot = await buildDocumentChecklistSnapshot(
    quotation.lead.serviceType,
    snapshotPassengers,
    destinationCountry?.id ?? null
  );

  // P13 — a Visa Extension booking links to the New Visa booking it extends (matched by applicant passport).
  const originalBookingId = quotation.lead.serviceType === "VISA_EXTENSION" ? await findOriginalBookingForExtension(quotation.lead.details) : null;

  const booking = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.booking.create({
      data: {
        bookingId: await bookingIdForLead(tx, quotation.lead),
        serviceStatusId: await getInitialServiceStatusId(tx, quotation.lead.serviceType, "BOOKING"),
        customerToken: generateToken(),
        leadId: quotation.leadId,
        customerId: quotation.lead.customerId,
        status: "PENDING",
        documentChecklistSnapshot: documentChecklistSnapshot as unknown as Prisma.InputJsonValue,
        originalBookingId,
      },
    });

    if (passengerIds.length > 0) {
      await tx.bookingPassenger.createMany({
        data: passengerIds.map((passengerId) => ({ bookingId: created.id, passengerId, status: created.status })),
      });
    }

    // P12 — only where Admin enabled Protection Plan for the destination;
    // passengers chosen on the form (terms accepted) are charged now.
    const planRows = protectionPlanRowsForBooking({ bookingId: created.id, passengerIds, offer: protectionPlanOffer, leadDetails: quotation.lead.details });
    if (planRows.rows.length > 0) {
      await tx.protectionPlan.createMany({ data: planRows.rows });
      await writeAudit(tx, {
        entityType: "Booking",
        entityId: created.id,
        action: "PROTECTION_PLAN_OFFERED",
        note: `Protection Plan offered to ${planRows.rows.length} passenger(s) at ₹${protectionPlanOffer?.price} each${planRows.chosen > 0 ? `; ${planRows.chosen} chosen with terms accepted on the application form — terms shown: ${protectionPlanOffer?.termsText}` : ""}`,
      });
    }

    await writeAudit(tx, {
      entityType: "Booking",
      entityId: created.id,
      action: "CREATE",
      byUserId: actor.byUserId,
      note: `Booking initiated from quotation ${quotation.id}${originalBookingId ? ` — extends original booking ${originalBookingId}` : ""} (${actor.label})`,
    });

    return created;
  });

  // P22 — staff notifications feed (after commit; never throws).
  await notifyNewBooking(booking.id);

  return { ok: true, booking };
}
