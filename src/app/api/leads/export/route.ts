import type { NextRequest } from "next/server";
import { leadListQuerySchema } from "@/lib/validation/lead-query-schema";
import { jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { serviceTypeCondition } from "@/lib/auth/service-scope";
import { formatLeadReference } from "@/lib/leads/reference";
import { toCsv } from "@/lib/csv/to-csv";
import { SERVICE_TYPE_LABELS, LEAD_STATUS_LABELS } from "@/lib/crm/labels";

/**
 * Step 54 — CSV export for the Leads list, respecting the screen's own
 * active filters (not the Admin-only, unfiltered `data.export` bulk
 * export from Phase 4D). Mirrors GET /api/leads's own where-clause exactly
 * so "what you see is what you export," minus pagination.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("leads.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = leadListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }

  const { serviceType, status, temperature, search, dateFrom, dateTo } = parsed.data;

  const where = {
    ...serviceTypeCondition(auth.session, serviceType),
    ...(status ? { status } : {}),
    ...(temperature ? { temperature } : {}),
    ...(dateFrom || dateTo
      ? { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } }
      : {}),
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

  const leads = await db.lead.findMany({
    where,
    include: { customer: true, assignedStaff: true },
    orderBy: { createdAt: "desc" },
  });

  const csv = toCsv(leads, [
    { key: "referenceId", header: "Reference", value: (row) => formatLeadReference(row.serviceType, row.id) },
    { key: "service", header: "Service", value: (row) => SERVICE_TYPE_LABELS[row.serviceType] },
    { key: "status", header: "Status", value: (row) => LEAD_STATUS_LABELS[row.status] },
    { key: "customerName", header: "Customer Name", value: (row) => row.customer.name },
    { key: "customerMobile", header: "Customer Mobile", value: (row) => row.customer.mobile },
    { key: "assignedStaff", header: "Assigned Staff", value: (row) => row.assignedStaff?.name ?? "" },
    { key: "createdAt", header: "Created At", value: (row) => row.createdAt.toISOString() },
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
