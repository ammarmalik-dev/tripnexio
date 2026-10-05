import type { NextRequest } from "next/server";
import { leadListQuerySchema } from "@/lib/validation/lead-query-schema";
import { jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { leadListWhere } from "@/lib/leads/list-where";
import { leadReference } from "@/lib/leads/reference";
import { csvExportResponse, EXPORT_QUERY_TAKE, exportFiltersFromSearchParams } from "@/lib/csv/export-guard";
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

  const where = leadListWhere(auth.session, parsed.data);

  const leads = await db.lead.findMany({
    take: EXPORT_QUERY_TAKE,
    where,
    include: { customer: true, assignedStaff: true, country: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return csvExportResponse({
    exportName: "leads",
    filename: `leads-${new Date().toISOString().slice(0, 10)}.csv`,
    rows: leads,
    byUserId: auth.session.id,
    filters: exportFiltersFromSearchParams(searchParams),
    columns: [
      { key: "referenceId", header: "Reference", value: (row) => leadReference(row) },
      { key: "service", header: "Service", value: (row) => SERVICE_TYPE_LABELS[row.serviceType] },
      { key: "status", header: "Status", value: (row) => LEAD_STATUS_LABELS[row.status] },
      { key: "customerName", header: "Customer Name", value: (row) => row.customer.name },
      { key: "customerMobile", header: "Customer Mobile", value: (row) => row.customer.mobile },
      { key: "country", header: "Country", value: (row) => row.country?.name ?? "" },
      { key: "travelDate", header: "Travel Date", value: (row) => (row.travelDate ? row.travelDate.toISOString().slice(0, 10) : "") },
      { key: "pax", header: "PAX", value: (row) => (row.paxCount === null ? "" : String(row.paxCount)) },
      { key: "temperature", header: "Temperature", value: (row) => row.temperature ?? "" },
      { key: "assignedStaff", header: "POC", value: (row) => row.assignedStaff?.name ?? "" },
      { key: "createdAt", header: "Created At", value: (row) => row.createdAt.toISOString() },
    ],
  });
}
