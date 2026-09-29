import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { writeAudit } from "@/lib/audit/log";
import { describeError } from "@/lib/api/describe-error";
import { linkServiceBookings, returnTicketVendorSchema } from "@/lib/return-ticket/operations";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("LINK_BOOKING"), otherBookingId: z.string().trim().min(3, "Enter the other booking's ID").max(60) }),
  z.object({ action: z.literal("SAVE_VENDOR") }).extend(returnTicketVendorSchema.shape),
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

    // SAVE_VENDOR
    if (booking.lead.serviceType !== "RETURN_TICKET") return jsonError(409, "Vendor details here are for Return Verified Ticket bookings.");
    const quotation = booking.lead.quotations[0];
    if (!quotation) return jsonError(409, "This booking has no selected quotation to record the vendor against.");
    const vendor = await db.vendor.findUnique({ where: { id: data.vendorId }, select: { id: true, name: true, active: true } });
    if (!vendor || !vendor.active) return jsonError(400, "Select an active vendor.", { vendorId: ["Select an active vendor."] });

    const margin = Number(quotation.sellingPrice) - data.vendorCost;
    await db.$transaction(async (tx) => {
      await tx.quotation.update({ where: { id: quotation.id }, data: { vendorId: vendor.id, vendorCost: data.vendorCost, margin } });
      await tx.booking.update({
        where: { id },
        data: { pnrVendorReference: data.vendorReference || null, pnr: data.pnr ? data.pnr.toUpperCase() : null },
      });
      await writeAudit(tx, {
        entityType: "Booking",
        entityId: id,
        action: "VENDOR_DETAILS",
        byUserId: session.id,
        note: `Vendor ${vendor.name}, reference ${data.vendorReference || "—"}, PNR ${data.pnr ? data.pnr.toUpperCase() : "—"} (by ${session.name})`,
      });
    });
    return jsonSuccess({ saved: true });
  } catch (error) {
    console.error("[bookings/return-ticket-action]", describeError(error));
    return jsonError(500, "Couldn't complete that action. Please try again.");
  }
}
