import type { Prisma } from "../../generated/prisma/client";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { placeholderBookingId } from "./reference";
import { isExpiredNow } from "../quotations/sync-expiry";
import { getProtectionPlanDefaultPrice } from "../settings/protection-plan-config";
import { buildDocumentChecklistSnapshot } from "./document-checklist-snapshot";
import { generateToken } from "../quotations/select-quotation";

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
  // list) exists. New Visa only.
  const protectionPlanPrice = quotation.lead.serviceType === "NEW_VISA" ? await getProtectionPlanDefaultPrice() : null;

  const snapshotPassengers =
    passengerIds.length > 0
      ? await db.passenger.findMany({
          where: { id: { in: passengerIds } },
          select: { id: true, fullName: true, nationality: true },
        })
      : [];
  const documentChecklistSnapshot = await buildDocumentChecklistSnapshot(quotation.lead.serviceType, snapshotPassengers);

  const booking = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.booking.create({
      data: {
        bookingId: placeholderBookingId(),
        customerToken: generateToken(),
        leadId: quotation.leadId,
        customerId: quotation.lead.customerId,
        status: "PENDING",
        documentChecklistSnapshot: documentChecklistSnapshot as unknown as Prisma.InputJsonValue,
      },
    });

    if (passengerIds.length > 0) {
      await tx.bookingPassenger.createMany({
        data: passengerIds.map((passengerId) => ({ bookingId: created.id, passengerId, status: created.status })),
      });
    }

    if (protectionPlanPrice !== null && passengerIds.length > 0) {
      await tx.protectionPlan.createMany({
        data: passengerIds.map((passengerId) => ({
          bookingId: created.id,
          passengerId,
          status: "OFFERED",
          price: protectionPlanPrice,
        })),
      });
      await writeAudit(tx, {
        entityType: "Booking",
        entityId: created.id,
        action: "PROTECTION_PLAN_OFFERED",
        note: `Protection Plan offered to ${passengerIds.length} passenger(s) at ₹${protectionPlanPrice} each`,
      });
    }

    await writeAudit(tx, {
      entityType: "Booking",
      entityId: created.id,
      action: "CREATE",
      byUserId: actor.byUserId,
      note: `Booking initiated from quotation ${quotation.id} (${actor.label})`,
    });

    return created;
  });

  return { ok: true, booking };
}
