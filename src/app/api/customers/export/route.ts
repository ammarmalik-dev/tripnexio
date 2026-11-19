import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { exportScopedSession } from "@/lib/auth/service-actions";
import { serviceTypeCondition } from "@/lib/auth/service-scope";
import { csvExportResponse, EXPORT_QUERY_TAKE, exportFiltersFromSearchParams } from "@/lib/csv/export-guard";
import { customerListQuerySchema } from "@/lib/customers/list-query-schema";
import { customerListWhere } from "@/lib/customers/list-where";

/**
 * Client doc 16 Nov (K7) — Customers CSV export with the list's own search (replaces Admin → Data Export's customer
 * file). Same access as the list (leads.view, export-scoped services); row-capped and audited by csvExportResponse.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("leads.view");
  if (auth.error) return auth.error;
  const exportSession = exportScopedSession(auth.session);

  const { searchParams } = new URL(request.url);
  const parsed = customerListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);

  const leadScope = serviceTypeCondition(exportSession);
  const customers = await db.customer.findMany({
    where: customerListWhere(exportSession, parsed.data.search),
    orderBy: { createdAt: "desc" },
    take: EXPORT_QUERY_TAKE,
    select: {
      id: true,
      name: true,
      mobile: true,
      email: true,
      createdAt: true,
      accountDeletedAt: true,
      _count: { select: { leads: { where: leadScope }, bookings: { where: { lead: leadScope } } } },
    },
  });

  return csvExportResponse({
    exportName: "customers",
    filename: `customers-${new Date().toISOString().slice(0, 10)}.csv`,
    rows: customers,
    byUserId: auth.session.id,
    filters: exportFiltersFromSearchParams(searchParams),
    columns: [
      { key: "name", header: "Name", value: (row) => row.name },
      { key: "mobile", header: "Mobile", value: (row) => row.mobile },
      { key: "email", header: "Email", value: (row) => row.email ?? "" },
      { key: "leads", header: "Leads", value: (row) => String(row._count.leads) },
      { key: "bookings", header: "Bookings", value: (row) => String(row._count.bookings) },
      { key: "createdAt", header: "Customer Since", value: (row) => row.createdAt.toISOString().slice(0, 10) },
      { key: "deleted", header: "Account Deleted", value: (row) => (row.accountDeletedAt ? "Yes" : "") },
    ],
  });
}
