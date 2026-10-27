import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertServiceAction } from "@/lib/auth/service-actions";
import { assertOwnsRecord } from "@/lib/auth/ownership";
import { bookingVendorRateOptions, setBookingVendor } from "@/lib/bookings/set-vendor";
import { hasPermission } from "@/lib/auth/permissions";
import { describeError } from "@/lib/api/describe-error";
import { resolveLeadSubServiceCodes, vendorSubServiceProblem } from "@/lib/vendors/sub-service-scope";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  vendorId: z.string().trim().min(1, "Select a vendor"),
  reason: z.string().trim().min(5, "Give a short reason (at least 5 characters)").max(300),
});

/**
 * Client doc 2026-10-27 (C13) — the vendors with a rate for this booking, for the vendor question at Sent to
 * Airlines / Applied to Embassy. The cost each would set is internal: only with vendors.viewCost / finance.manage
 * (otherwise omitted, not hidden). `rated: false` = no vendor has a rate yet (the panel falls back to every vendor).
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("bookings.view");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;
  try {
    const booking = await db.booking.findUnique({ where: { id }, select: { lead: { select: { serviceType: true } } } });
    if (!booking) return jsonError(404, "Booking not found.");
    const scopeError = assertServiceAccess(session, booking.lead.serviceType);
    if (scopeError) return scopeError;
    const showCost = hasPermission(session, "vendors.viewCost") || hasPermission(session, "finance.manage");
    const options = await bookingVendorRateOptions(db, id);
    return jsonSuccess({
      rated: options.length > 0,
      vendors: options.map((option) => (showCost ? option : { id: option.id, name: option.name })),
    });
  } catch (error) {
    console.error("[bookings/vendor GET]", describeError(error));
    return jsonError(500, "Couldn't load the vendors.");
  }
}

/**
 * Client testing 2026-10-09 (E12) — set or change the vendor processing a
 * booking (a vendor change is a Locked-Q14 sensitive action: reason required,
 * audited). The vendor lives on the lead's selected quotation.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  try {
    const booking = await db.booking.findUnique({ where: { id }, select: { leadId: true, lead: { select: { serviceType: true, assignedStaffId: true, details: true } } } });
    if (!booking) return jsonError(404, "Booking not found.");
    const scopeError = assertServiceAccess(session, booking.lead.serviceType);
    if (scopeError) return scopeError;
    const actionError = assertServiceAction(session, booking.lead.serviceType, "BOOKING");
    if (actionError) return actionError;
    const ownershipError = assertOwnsRecord(session, booking.lead.assignedStaffId);
    if (ownershipError) return ownershipError;

    const vendor = await db.vendor.findFirst({ where: { id: parsed.data.vendorId, active: true }, select: { id: true, name: true } });
    if (!vendor) return jsonError(400, "Select a valid, active vendor.", { vendorId: ["This vendor isn't available."] });
    // Admin handover §12 — the vendor must cover the lead's sub-service (none recorded = any vendor of the service).
    const subServiceCodes = await resolveLeadSubServiceCodes(booking.lead.serviceType, booking.lead.details);
    const coverageProblem = await vendorSubServiceProblem(vendor.id, booking.lead.serviceType, subServiceCodes);
    if (coverageProblem) return jsonError(400, coverageProblem, { vendorId: [coverageProblem] });

    const problem = await db.$transaction((tx) =>
      setBookingVendor(tx, { bookingId: id, leadId: booking.leadId, vendor, actor: { userId: session.id, name: session.name }, reason: parsed.data.reason })
    );
    if (problem) return jsonError(409, problem);
    return jsonSuccess({ vendorId: vendor.id, vendorName: vendor.name });
  } catch (error) {
    console.error("[api/bookings/vendor]", describeError(error));
    return jsonError(500, "Couldn't save the vendor.");
  }
}
