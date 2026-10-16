import { db } from "../db";
import { assertOwnsRecord, seesAllRecords } from "./ownership";

type OwnedEntity = "lead" | "booking" | "quotation" | "payment" | "document";

/**
 * Client doc 2026-10-15 (C6) — staff act only on their own (or unassigned) leads, and on the bookings,
 * quotations, payments and documents of those leads; managers / Admins (leads.reassign) act on all.
 * Enforced on every mutation route, not just by hiding the record in lists. Returns a 403 response or
 * null; an unknown id returns null so the route's own 404 handling still applies.
 */
export async function assertOwnsEntity(session: { id: string; permissions: string[] }, entity: OwnedEntity, id: string): Promise<Response | null> {
  if (seesAllRecords(session)) return null;
  const lead = { select: { assignedStaffId: true } } as const;
  let assignedStaffId: string | null | undefined;
  switch (entity) {
    case "lead":
      assignedStaffId = (await db.lead.findUnique({ where: { id }, select: { assignedStaffId: true } }))?.assignedStaffId;
      break;
    case "booking":
      assignedStaffId = (await db.booking.findUnique({ where: { id }, select: { lead } }))?.lead.assignedStaffId;
      break;
    case "quotation":
      assignedStaffId = (await db.quotation.findUnique({ where: { id }, select: { lead } }))?.lead.assignedStaffId;
      break;
    case "payment":
      assignedStaffId = (await db.payment.findUnique({ where: { id }, select: { booking: { select: { lead } } } }))?.booking.lead.assignedStaffId;
      break;
    case "document": {
      const document = await db.document.findUnique({ where: { id }, select: { lead, booking: { select: { lead } } } });
      assignedStaffId = document?.lead?.assignedStaffId ?? document?.booking?.lead.assignedStaffId;
      break;
    }
  }
  return assertOwnsRecord(session, assignedStaffId);
}
