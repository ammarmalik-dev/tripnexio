import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertServiceAction } from "@/lib/auth/service-actions";
import { earlyIssueBlock } from "@/lib/return-ticket/early-hold";
import { ADMIN_FULL_PERMISSION } from "@/lib/auth/permissions";
import { writeAudit } from "@/lib/audit/log";
import { describeError } from "@/lib/api/describe-error";
import { linkedOtbState, linkServiceBookings, returnTicketVendorSchema } from "@/lib/return-ticket/operations";
import { setBookingVendor } from "@/lib/bookings/set-vendor";
import { dispatchStatusNotifications, setServiceStatusByEvent } from "@/lib/service-status/engine";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("LINK_BOOKING"), otherBookingId: z.string().trim().min(3, "Enter the other booking's ID").max(60) }),
  z.object({ action: z.literal("SAVE_VENDOR") }).extend(returnTicketVendorSchema.shape),
  // Client doc 2026-10-20 (B1) — pick the vendor as the request goes to the airline; its rate sets the cost.
  z.object({
    action: z.literal("SEND_TO_AIRLINES"),
    vendorId: z.string().trim().min(1, "Select the vendor"),
    pnr: z.string().trim().max(40).optional(),
  }),
]);

/**
 * P17 — Return Verified Ticket / OTB staff actions on a booking:
 * - LINK_BOOKING: CRM.md §15 — link this booking with the customer's
 *   matching OTB / Return Ticket booking (both ways, cross-timeline audit).
 *   Accepts the other booking's reference (TNX-...) or its internal id.
 * - SAVE_VENDOR: Return_Verified_Ticket.md §18 — vendor, vendor cost,
 *   vendor reference and PNR. Vendor cost and margin stay internal (staff
 *   CRM only); margin is recomputed server-side from the selected quote.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("bookings.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;
  // Client doc 2026-10-15 (C6) — only the record's own staff (or a manager / Admin) can act on it.
  const ownershipError = await assertOwnsEntity(auth.session, "booking", id);
  if (ownershipError) return ownershipError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  const booking = await db.booking.findUnique({
    where: { id },
    include: { lead: { include: { quotations: { where: { isSelected: true }, take: 1 } } } },
  });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;
  // Admin handover §1 (client 2026-10-25) — the service-wise "BOOKING" action.
  const actionError = assertServiceAction(session, booking.lead.serviceType, "BOOKING");
  if (actionError) return actionError;

  try {
    const data = parsed.data;
    if (data.action === "LINK_BOOKING") {
      if (booking.lead.serviceType !== "OTB" && booking.lead.serviceType !== "RETURN_TICKET") {
        return jsonError(409, "Only OTB and Return Verified Ticket bookings can be linked.");
      }
      const other = await db.booking.findFirst({
        where: { OR: [{ bookingId: data.otherBookingId.toUpperCase() }, { id: data.otherBookingId }] },
        select: { id: true, lead: { select: { serviceType: true } } },
      });
      if (!other) return jsonError(404, "No booking with that ID.", { otherBookingId: ["No booking with that ID."] });
      const otherScopeError = assertServiceAccess(session, other.lead.serviceType);
      if (otherScopeError) return otherScopeError;

      const result = await db.$transaction((tx) =>
        linkServiceBookings(tx, { bookingId: id, otherBookingId: other.id, userId: session.id, actorLabel: `by ${session.name}` })
      );
      if (!result.ok) return jsonError(result.httpStatus, result.error);
      return jsonSuccess({ linked: true });
    }

    if (data.action === "SEND_TO_AIRLINES") {
      if (booking.lead.serviceType !== "RETURN_TICKET") return jsonError(409, "This is for Return Verified Ticket bookings.");
      // Client 2026-10-25 — an early booking waits On Hold until the day before travel (Admin may override).
      const early = earlyIssueBlock(booking.lead.travelDate, session.permissions.includes(ADMIN_FULL_PERMISSION));
      if (early) return jsonError(409, early);
      const vendor = await db.vendor.findUnique({ where: { id: data.vendorId }, select: { id: true, name: true, active: true } });
      if (!vendor || !vendor.active) return jsonError(400, "Select an active vendor.", { vendorId: ["Select an active vendor."] });
      const otb = await linkedOtbState(id);
      if (!otb.issuanceAllowed) return jsonError(409, `The linked OTB booking ${otb.otb?.bookingId} isn't approved yet.`);
      const result = await db.$transaction(async (tx) => {
        const vendorError = await setBookingVendor(tx, { bookingId: id, leadId: booking.leadId, vendor, actor: { userId: session.id, name: session.name } });
        if (vendorError) return { ok: false as const, httpStatus: 409, error: vendorError };
        if (data.pnr) await tx.booking.update({ where: { id }, data: { pnr: data.pnr.toUpperCase() } });
        return setServiceStatusByEvent(tx, { scope: "BOOKING", entityId: id, event: "SENT_TO_AIRLINES", note: `vendor ${vendor.name}`, userId: session.id, actorLabel: `by ${session.name}` });
      });
      if (!result.ok) return jsonError(result.httpStatus, result.error);
      await dispatchStatusNotifications([result.notification]);
      return jsonSuccess({ sent: true });
    }

    // SAVE_VENDOR
    if (booking.lead.serviceType !== "RETURN_TICKET") return jsonError(409, "Vendor details here are for Return Verified Ticket bookings.");
    const quotation = booking.lead.quotations[0];
    if (!quotation) return jsonError(409, "This booking has no selected quotation to record the vendor against.");
    const vendor = await db.vendor.findUnique({ where: { id: data.vendorId }, select: { id: true, name: true, active: true } });
    if (!vendor || !vendor.active) return jsonError(400, "Select an active vendor.", { vendorId: ["Select an active vendor."] });

    // Business Rules §14 "Sensitive Admin Actions" — changing the booking's vendor or vendor cost needs the confirmation reason; saving only the reference/PNR doesn't.
    const costChanged = data.vendorCost !== undefined && data.vendorCost !== Number(quotation.vendorCost);
    const vendorChanged = vendor.id !== quotation.vendorId || costChanged;
    const reasonResult = readBodyReason(body);
    if (vendorChanged && reasonResult.error) return reasonResult.error;
    const reason = reasonResult.reason ?? null;

    const vendorNote = `Vendor ${vendor.name}, reference ${data.vendorReference || "—"}, PNR ${data.pnr ? data.pnr.toUpperCase() : "—"} (by ${session.name})`;
    const result = await db.$transaction(async (tx) => {
      // Client 2026-10-23 audit — a new vendor takes its configured rate (server-side, same as Send to Airlines),
      // never the old vendor's cost posted back by the form; a cost typed by staff overrides it.
      const vendorError = await setBookingVendor(tx, { bookingId: id, leadId: booking.leadId, vendor, actor: { userId: session.id, name: session.name }, reason });
      if (vendorError) return vendorError;
      if (costChanged && data.vendorCost !== undefined) {
        await tx.quotation.update({ where: { id: quotation.id }, data: { vendorCost: data.vendorCost, margin: Number(quotation.sellingPrice) - data.vendorCost } });
      }
      await tx.booking.update({
        where: { id },
        data: { pnrVendorReference: data.vendorReference || null, pnr: data.pnr ? data.pnr.toUpperCase() : null },
      });
      await writeAudit(tx, {
        entityType: "Booking",
        entityId: id,
        action: "VENDOR_DETAILS",
        byUserId: session.id,
        note: reason ? withReason(vendorNote, reason) : vendorNote,
      });
      return null;
    });
    if (result) return jsonError(409, result);
    return jsonSuccess({ saved: true });
  } catch (error) {
    console.error("[bookings/return-ticket-action]", describeError(error));
    return jsonError(500, "Couldn't complete that action. Please try again.");
  }
}
