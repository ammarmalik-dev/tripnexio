import type { Prisma } from "../../generated/prisma/client";
import { isServiceScopeUnrestricted, serviceTypeCondition } from "../auth/service-scope";

type ScopeSession = Parameters<typeof serviceTypeCondition>[0];

/**
 * The Payments list / export condition on the booking's lead: the staff member's service scope and, client doc
 * 16 Nov (K3), the POC filter ("unassigned" = no POC). Empty when neither applies.
 */
export function paymentLeadWhere(session: ScopeSession, assignedStaffId?: string): Prisma.PaymentWhereInput {
  const conditions: Prisma.LeadWhereInput[] = [
    ...(!isServiceScopeUnrestricted(session) ? [serviceTypeCondition(session)] : []),
    ...(assignedStaffId ? [{ assignedStaffId: assignedStaffId === "unassigned" ? null : assignedStaffId }] : []),
  ];
  return conditions.length > 0 ? { booking: { lead: { AND: conditions } } } : {};
}
