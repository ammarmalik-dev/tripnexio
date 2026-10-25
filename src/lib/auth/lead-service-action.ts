import { db } from "../db";
import { assertServiceAccess } from "./service-scope";
import { assertServiceAction, type ServiceActionCheckable, type StaffServiceAction } from "./service-actions";
import type { ServiceScopeCheckable } from "./service-scope";

/**
 * Admin handover §1 — the service scope + service-wise action check for a record that hangs off a lead without a
 * booking yet (a lead-stage document, a lead's messages). No lead = not service-scoped (e.g. a passenger-only
 * document), as before.
 */
export async function assertLeadServiceAction(
  session: ServiceScopeCheckable & ServiceActionCheckable,
  leadId: string | null | undefined,
  action: StaffServiceAction
): Promise<Response | null> {
  if (!leadId) return null;
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { serviceType: true } });
  if (!lead) return null;
  return assertServiceAccess(session, lead.serviceType) ?? assertServiceAction(session, lead.serviceType, action);
}
