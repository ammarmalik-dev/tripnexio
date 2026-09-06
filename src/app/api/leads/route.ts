import type { NextRequest } from "next/server";
import { leadListQuerySchema } from "@/lib/validation/lead-query-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { formatLeadReference } from "@/lib/leads/reference";

export async function GET(request: NextRequest) {
  const auth = await requirePermission("leads.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = leadListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }

  const { serviceType, status, search, sort, page, pageSize } = parsed.data;

  const where = {
    ...(serviceType ? { serviceType } : {}),
    ...(status ? { status } : {}),
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
    source: lead.source,
    createdAt: lead.createdAt,
    customer: { name: lead.customer.name, mobile: lead.customer.mobile, email: lead.customer.email },
    assignedStaff: lead.assignedStaff ? { id: lead.assignedStaff.id, name: lead.assignedStaff.name } : null,
  }));

  return jsonSuccess({ items, total, page, pageSize });
}
