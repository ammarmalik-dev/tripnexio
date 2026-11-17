import type { Prisma } from "../../generated/prisma/client";
import { hasPermission } from "./permissions";
import { jsonError } from "../api/respond";

interface OwnershipSession {
  id: string;
  permissions: string[];
}

/**
 * Client testing 2026-10-09 (E7) — staff see and act on their own records:
 * a staff member without `leads.reassign` (i.e. not a manager / Admin) sees
 * the leads assigned to them plus unassigned ones (so they can still claim
 * new work), and the bookings / quotations of those leads. Managers and
 * Admins (leads.reassign or admin.full) see everything in their service scope.
 */
export function seesAllRecords(session: OwnershipSession): boolean {
  return hasPermission(session, "leads.reassign");
}

/**
 * Client doc 16 Nov (J6) — "View All Bookings": staff with bookings.viewAll SEE every record (lists, detail pages) but
 * still ACT only on their own (assertOwnsEntity / assertOwnsRecord keep using seesAllRecords). Viewing never grants
 * the right to act.
 */
export function seesAllForViewing(session: OwnershipSession): boolean {
  return seesAllRecords(session) || hasPermission(session, "bookings.viewAll");
}

/** A 403 for opening a record assigned to someone else — unless the viewer may view all records (J6). */
export function assertCanViewRecord(session: OwnershipSession, assignedStaffId: string | null | undefined): Response | null {
  if (seesAllForViewing(session)) return null;
  return assertOwnsRecord(session, assignedStaffId);
}

export function leadOwnershipWhere(session: OwnershipSession): Prisma.LeadWhereInput {
  if (seesAllForViewing(session)) return {};
  return { OR: [{ assignedStaffId: session.id }, { assignedStaffId: null }] };
}

/** A 403 for a record assigned to someone else (null when the staff member may open it). */
export function assertOwnsRecord(session: OwnershipSession, assignedStaffId: string | null | undefined): Response | null {
  if (seesAllRecords(session) || !assignedStaffId || assignedStaffId === session.id) return null;
  return jsonError(403, "This record is assigned to another team member.");
}
