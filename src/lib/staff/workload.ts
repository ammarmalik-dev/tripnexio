import { db } from "@/lib/db";
import type { BookingStatus } from "@/generated/prisma/enums";

/** Matches the same terminal-status set used elsewhere (e.g. document-retention automation). */
const TERMINAL_BOOKING_STATUSES: BookingStatus[] = ["COMPLETED", "CANCELLED", "REFUNDED"];

export interface StaffWorkload {
  staffId: string;
  openBookingCount: number;
  paxCount: number;
}

/**
 * Step 26 (audit §3.11/§4.7) — ADMIN.md §13's locked, worked-example rule:
 * "Workload is based on number of PAX," not bookings — a staff member with
 * fewer bookings but more total passengers is MORE loaded, not less.
 *
 * A booking's owner is its parent Lead's `assignedStaffId` — there's no
 * separate Booking-level assignment field, and none is needed: a Lead can
 * have at most one non-terminal ("active") Booking at a time (enforced by
 * POST /api/bookings' own 409 check when one already exists), so
 * `Lead.assignedStaffId` is already a reliable 1:1 proxy for "who owns this
 * lead's one open booking, if it has one." Reusing it keeps a single source
 * of truth for assignment, consistent with every other assignment-aware
 * screen (LeadAssignmentControl, etc.) instead of forking ownership across
 * two fields that could drift out of sync.
 */
export async function getStaffWorkloads(staffIds: string[]): Promise<Map<string, StaffWorkload>> {
  const workloads = new Map<string, StaffWorkload>(staffIds.map((id) => [id, { staffId: id, openBookingCount: 0, paxCount: 0 }]));
  if (staffIds.length === 0) return workloads;

  const bookings = await db.booking.findMany({
    where: {
      lead: { assignedStaffId: { in: staffIds } },
      status: { notIn: TERMINAL_BOOKING_STATUSES },
    },
    select: {
      lead: { select: { assignedStaffId: true } },
      _count: { select: { passengers: true } },
    },
  });

  for (const booking of bookings) {
    const staffId = booking.lead.assignedStaffId;
    if (!staffId) continue;
    const workload = workloads.get(staffId);
    if (!workload) continue;
    workload.openBookingCount += 1;
    workload.paxCount += booking._count.passengers;
  }

  return workloads;
}

export async function getStaffWorkload(staffId: string): Promise<StaffWorkload> {
  const workloads = await getStaffWorkloads([staffId]);
  return workloads.get(staffId) ?? { staffId, openBookingCount: 0, paxCount: 0 };
}
