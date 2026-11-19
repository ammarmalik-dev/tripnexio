import { db } from "../db";
import { hasPermission, type PermissionCheckable } from "../auth/permissions";
import { SUPPORT_TICKET_MANAGER_PERMISSION } from "./tickets";

export function canManageTickets(session: PermissionCheckable | null): boolean {
  return hasPermission(session, SUPPORT_TICKET_MANAGER_PERMISSION);
}

/**
 * Client doc 16 Nov (L3) — a ticket is visible to the staff member who raised it and to the help desk managers; for
 * anyone else it doesn't exist (null → 404, never a hint that it does).
 */
export async function findVisibleTicket(session: PermissionCheckable & { id: string }, ticketId: string) {
  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true, raisedById: true, ticketNumber: true, status: true } });
  if (!ticket) return null;
  return ticket.raisedById === session.id || canManageTickets(session) ? ticket : null;
}
