import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { isServiceScopeUnrestricted, serviceTypeCondition } from "@/lib/auth/service-scope";
import { parseLeadReference } from "@/lib/leads/reference";
import { customerListQuerySchema } from "@/lib/customers/list-query-schema";
import type { CustomerListItem, CustomerListResponse } from "@/lib/customers/types";
import type { Prisma } from "@/generated/prisma/client";

/**
 * CRM.md §23 — Customers list. Gated by `leads.view` (a customer record is
 * the parent of the leads staff already see; no dedicated customer
 * permission exists). A service-scoped staff member only sees customers
 * with at least one lead in their allowed services, and the #leads /
 * #bookings counts only count those in-scope records.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("leads.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = customerListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }
  const { search, page, pageSize } = parsed.data;

  try {
    const unrestricted = isServiceScopeUnrestricted(auth.session);
    const leadScope: Prisma.LeadWhereInput = serviceTypeCondition(auth.session);

    const conditions: Prisma.CustomerWhereInput[] = [];
    if (!unrestricted) conditions.push({ leads: { some: leadScope } });

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
      if (legacy) {
        or.push({ leads: { some: { serviceType: legacy.serviceType, id: { endsWith: legacy.suffix } } } });
      }
      conditions.push({ OR: or });
    }

    const where: Prisma.CustomerWhereInput = conditions.length ? { AND: conditions } : {};

    const [total, customers] = await Promise.all([
      db.customer.count({ where }),
      db.customer.findMany({
        where,
        select: {
          id: true,
          name: true,
          mobile: true,
          email: true,
          createdAt: true,
          _count: {
            select: {
              leads: { where: leadScope },
              bookings: { where: unrestricted ? {} : { lead: leadScope } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items: CustomerListItem[] = customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      mobile: customer.mobile,
      email: customer.email,
      leadCount: customer._count.leads,
      bookingCount: customer._count.bookings,
      createdAt: customer.createdAt.toISOString(),
    }));

    const body: CustomerListResponse = { items, total, page, pageSize };
    return jsonSuccess(body);
  } catch (error) {
    console.error("GET /api/customers failed", error);
    return jsonError(500, "Couldn't load customers. Please try again.");
  }
}
