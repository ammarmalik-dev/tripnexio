import type { Prisma } from "../../generated/prisma/client";
import { isServiceScopeUnrestricted, serviceTypeCondition } from "../auth/service-scope";
import { parseLeadReference } from "../leads/reference";

type ScopeSession = Parameters<typeof serviceTypeCondition>[0];

/**
 * The Customers list `where` (CRM.md §23), shared by the list and its CSV export (client doc 16 Nov, K7): a
 * service-scoped staff member only sees customers with a lead in their services; the search matches name, mobile,
 * email, passport, lead reference or Booking ID.
 */
export function customerListWhere(session: ScopeSession, search: string | undefined): Prisma.CustomerWhereInput {
  const conditions: Prisma.CustomerWhereInput[] = [];
  if (!isServiceScopeUnrestricted(session)) conditions.push({ leads: { some: serviceTypeCondition(session) } });
  if (search) {
    const contains = { contains: search, mode: "insensitive" as const };
    const or: Prisma.CustomerWhereInput[] = [
      { name: contains },
      { mobile: contains },
      { email: contains },
      { passengers: { some: { passportNumber: contains } } },
      { leads: { some: { reference: contains } } },
      { bookings: { some: { bookingId: contains } } },
    ];
    // Leads created before stored references ("OTB-JYOQHX") only have a derived reference.
    const legacy = parseLeadReference(search);
    if (legacy) or.push({ leads: { some: { serviceType: legacy.serviceType, id: { endsWith: legacy.suffix } } } });
    conditions.push({ OR: or });
  }
  return conditions.length ? { AND: conditions } : {};
}
