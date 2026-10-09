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

export function leadOwnershipWhere(session: OwnershipSession): Prisma.LeadWhereInput {
  if (seesAllRecords(session)) return {};
  return { OR: [{ assignedStaffId: session.id }, { assignedStaffId: null }] };
}

/** A 403 for a record assigned to someone else (null when the staff member may open it). */
export function assertOwnsRecord(session: OwnershipSession, assignedStaffId: string | null | undefined): Response | null {
  if (seesAllRecords(session) || !assignedStaffId || assignedStaffId === session.id) return null;
  return jsonError(403, "This record is assigned to another team member.");
}
