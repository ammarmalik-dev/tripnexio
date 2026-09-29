import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { csvExportResponse, EXPORT_QUERY_TAKE } from "@/lib/csv/export-guard";

export async function GET() {
  const auth = await requirePermission("data.export");
  if (auth.error) return auth.error;

  const customers = await db.customer.findMany({ take: EXPORT_QUERY_TAKE, orderBy: { createdAt: "asc" } });

  return csvExportResponse({
    exportName: "admin-customers",
    filename: `customers-${new Date().toISOString().slice(0, 10)}.csv`,
    rows: customers,
    byUserId: auth.session.id,
    filters: {},
    columns: [
      { key: "id", header: "ID", value: (row) => row.id },
      { key: "name", header: "Name", value: (row) => row.name },
      { key: "mobile", header: "Mobile", value: (row) => row.mobile },
      { key: "email", header: "Email", value: (row) => row.email ?? "" },
      { key: "createdAt", header: "Created At", value: (row) => row.createdAt.toISOString() },
    ],
  });
}
