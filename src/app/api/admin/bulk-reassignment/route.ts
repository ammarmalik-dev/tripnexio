import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { formatLeadReference } from "@/lib/leads/reference";
import type { BookingStatus } from "@/generated/prisma/enums";

/** Matches the same terminal-status set Unit 1's workload helper uses. */
const TERMINAL_BOOKING_STATUSES: BookingStatus[] = ["COMPLETED", "CANCELLED", "REFUNDED"];

/**
 * Step 26 Unit 4 (audit §3.11/§4.7) — ADMIN.md §13's bulk reassignment:
 * "Admin can select a POC/staff and move their open eligible work in one
 * action... Staff A → Open Bookings → Select All → Reassign → Staff B."
 *
 * Scoped to Bookings, per the spec's own wording — a Lead still awaiting
 * its first booking isn't covered here; reassign those individually via
 * the existing LeadAssignmentControl on the Lead detail page. What
 * actually gets reassigned is each open booking's parent Lead's
 * assignedStaffId (see src/lib/staff/workload.ts's own doc comment on why
 * there's no separate Booking-level assignment field).
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("leads.reassign");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get("staffId");
  if (!staffId) return jsonError(400, "Provide a staffId.");

  const staff = await db.user.findUnique({ where: { id: staffId } });
  if (!staff) return jsonError(404, "Staff member not found.");

  const bookings = await db.booking.findMany({
    where: { lead: { assignedStaffId: staffId }, status: { notIn: TERMINAL_BOOKING_STATUSES } },
    include: {
      lead: true,
      customer: true,
      _count: { select: { passengers: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return jsonSuccess({
    staff: { id: staff.id, name: staff.name },
    openWork: bookings.map((booking) => ({
      leadId: booking.leadId,
      bookingId: booking.id,
      bookingIdFormatted: booking.bookingId,
      leadReferenceId: formatLeadReference(booking.lead.serviceType, booking.leadId),
      serviceType: booking.lead.serviceType,
      status: booking.status,
      paxCount: booking._count.passengers,
      customerName: booking.customer.name,
    })),
  });
}

const bulkReassignSchema = z.object({
  fromStaffId: z.string().min(1),
  toStaffId: z.string().min(1),
  leadIds: z.array(z.string().min(1)).min(1, "Select at least one to reassign"),
  // ADMIN.md §13: "Manual reassignment should record a reason" — required
  // here (a bulk move of someone's whole book of work), unlike the
  // existing single-lead LeadAssignmentControl, which doesn't capture one
  // today — a disclosed scope boundary, not an oversight.
  reason: z.string().trim().min(1, "A reason is required"),
});

export async function POST(request: NextRequest) {
  const auth = await requirePermission("leads.reassign");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = bulkReassignSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.fromStaffId === parsed.data.toStaffId) {
    return jsonError(400, "Choose a different staff member to reassign to.", { toStaffId: ["Must be different from the current owner."] });
  }

  const toStaff = await db.user.findUnique({ where: { id: parsed.data.toStaffId } });
  if (!toStaff || !toStaff.active) {
    return jsonError(400, "Select a valid, active staff member.", { toStaffId: ["This staff member isn't available."] });
  }

  const leads = await db.lead.findMany({ where: { id: { in: parsed.data.leadIds } } });
  if (leads.length !== parsed.data.leadIds.length) {
    return jsonError(404, "One or more selected items weren't found — refresh and try again.");
  }
  const staleLeads = leads.filter((lead) => lead.assignedStaffId !== parsed.data.fromStaffId);
  if (staleLeads.length > 0) {
    return jsonError(409, "Some selected work has already been reassigned by someone else — refresh and try again.");
  }

  const reassigned = await db.$transaction(async (tx) => {
    const results = [];
    for (const lead of leads) {
      const updated = await tx.lead.update({ where: { id: lead.id }, data: { assignedStaffId: parsed.data.toStaffId } });
      await writeAudit(tx, {
        entityType: "Lead",
        entityId: lead.id,
        action: "ASSIGN",
        byUserId: session.id,
        note: `Bulk reassigned to ${toStaff.name} — reason: ${parsed.data.reason} (by ${session.name})`,
      });
      results.push(updated);
    }
    return results;
  });

  return jsonSuccess({ reassignedCount: reassigned.length });
}
