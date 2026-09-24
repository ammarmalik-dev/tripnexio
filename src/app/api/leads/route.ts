import type { NextRequest } from "next/server";
import { leadListQuerySchema } from "@/lib/validation/lead-query-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { serviceTypeCondition } from "@/lib/auth/service-scope";
import { formatLeadReference } from "@/lib/leads/reference";

export async function GET(request: NextRequest) {
  const auth = await requirePermission("leads.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = leadListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }

  const { serviceType, status, temperature, search, sort, page, pageSize } = parsed.data;

  const where = {
    ...serviceTypeCondition(auth.session, serviceType),
    ...(status ? { status } : {}),
    ...(temperature ? { temperature } : {}),
    ...(search
      ? {
          customer: {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { mobile: { contains: search, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  };

  const [total, leads] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({
      where,
      include: { customer: true, assignedStaff: true },
      orderBy: { createdAt: sort === "createdAt_asc" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items = leads.map((lead) => ({
    id: lead.id,
    referenceId: formatLeadReference(lead.serviceType, lead.id),
    serviceType: lead.serviceType,
    status: lead.status,
    temperature: lead.temperature,
    source: lead.source,
    createdAt: lead.createdAt,
    customer: { name: lead.customer.name, mobile: lead.customer.mobile, email: lead.customer.email },
    // Step 50 — `active` lets the UI show "Unassigned (was: Name)" for a
    // record whose assignee has since been deactivated, instead of quietly
    // rendering a name that no longer means the lead has an active owner.
    assignedStaff: lead.assignedStaff
      ? { id: lead.assignedStaff.id, name: lead.assignedStaff.name, active: lead.assignedStaff.active }
      : null,
  }));

  return jsonSuccess({ items, total, page, pageSize });
}
