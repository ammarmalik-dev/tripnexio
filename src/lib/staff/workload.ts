import { db } from "@/lib/db";
import type { BookingStatus, LeadStatus } from "@/generated/prisma/enums";

/** Matches the same terminal-status set used elsewhere (e.g. document-retention automation). */
export const TERMINAL_BOOKING_STATUSES: BookingStatus[] = ["COMPLETED", "CANCELLED", "REFUNDED"];
/** A lead in one of these is no longer open work (P22 item 8 — same set abandoned-draft.ts treats as terminal). */
export const TERMINAL_LEAD_STATUSES: LeadStatus[] = ["CONVERTED", "LOST", "CLOSED"];

export interface StaffWorkload {
  staffId: string;
  openBookingCount: number;
  /** P22 item 8 — open (non-terminal) leads assigned to this staff member, with or without a booking yet. */
  openLeadCount: number;
  paxCount: number;
}

/** Only the models this helper reads — lets a caller pass either the global client or a transaction client. */
type WorkloadClient = Pick<typeof db, "booking" | "lead">;

function passengerIdCount(details: unknown): number {
  if (typeof details !== "object" || details === null) return 0;
  const ids = (details as Record<string, unknown>).passengerIds;
  return Array.isArray(ids) ? ids.length : 0;
}

/**
 * Step 26 (audit §3.11/§4.7) — ADMIN.md §13's locked, worked-example rule:
 * "Workload is based on number of PAX," not bookings — a staff member with
 * fewer bookings but more total passengers is MORE loaded, not less.
 *
 * P22 item 8 — PAX workload = passengers on the staff member's open
 * bookings (status not COMPLETED/CANCELLED/REFUNDED, counted from the
 * booking's own BookingPassenger rows) PLUS passengers on their open leads
 * (status not CONVERTED/LOST/CLOSED) that don't have an open booking yet
 * (counted from the lead's `details.passengerIds`). A lead that already has
 * an open booking contributes through that booking only, so its passengers
 * are never counted twice. Before P22 only open bookings counted, which
 * made a staff member drowning in un-booked leads look idle.
 *
 * A booking's owner is its parent Lead's `assignedStaffId` — there's no
 * separate Booking-level assignment field, and none is needed: a Lead can
 * have at most one non-terminal ("active") Booking at a time (enforced by
 * POST /api/bookings' own 409 check when one already exists), so
 * `Lead.assignedStaffId` is already a reliable 1:1 proxy for "who owns this
 * lead's one open booking, if it has one."
 *
 * `client` defaults to the global client; pass a transaction client when
 * calling from inside `db.$transaction` (never mix the global client into
 * an open transaction — see "No global db inside a transaction").
 */
export async function getStaffWorkloads(staffIds: string[], client: WorkloadClient = db): Promise<Map<string, StaffWorkload>> {
  const workloads = new Map<string, StaffWorkload>(
    staffIds.map((id) => [id, { staffId: id, openBookingCount: 0, openLeadCount: 0, paxCount: 0 }])
  );
  if (staffIds.length === 0) return workloads;

  const bookings = await client.booking.findMany({
    where: {
      lead: { assignedStaffId: { in: staffIds } },
      status: { notIn: TERMINAL_BOOKING_STATUSES },
    },
    select: {
      leadId: true,
      lead: { select: { assignedStaffId: true } },
      _count: { select: { passengers: true } },
    },
  });

  const leadIdsWithOpenBooking = new Set<string>();
  for (const booking of bookings) {
    leadIdsWithOpenBooking.add(booking.leadId);
    const staffId = booking.lead.assignedStaffId;
    if (!staffId) continue;
    const workload = workloads.get(staffId);
    if (!workload) continue;
    workload.openBookingCount += 1;
    workload.paxCount += booking._count.passengers;
  }

  const openLeads = await client.lead.findMany({
    where: { assignedStaffId: { in: staffIds }, status: { notIn: TERMINAL_LEAD_STATUSES } },
    select: { id: true, assignedStaffId: true, details: true },
  });

  for (const lead of openLeads) {
    if (!lead.assignedStaffId) continue;
    const workload = workloads.get(lead.assignedStaffId);
    if (!workload) continue;
    workload.openLeadCount += 1;
    if (!leadIdsWithOpenBooking.has(lead.id)) {
      workload.paxCount += passengerIdCount(lead.details);
    }
  }

  return workloads;
}

export async function getStaffWorkload(staffId: string): Promise<StaffWorkload> {
  const workloads = await getStaffWorkloads([staffId]);
  return workloads.get(staffId) ?? { staffId, openBookingCount: 0, openLeadCount: 0, paxCount: 0 };
}
