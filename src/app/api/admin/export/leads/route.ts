import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { toCsv } from "@/lib/csv/to-csv";
import { formatLeadReference } from "@/lib/leads/reference";
import { SERVICE_TYPE_LABELS, LEAD_STATUS_LABELS } from "@/lib/crm/labels";

export async function GET() {
  const auth = await requirePermission("data.export");
  if (auth.error) return auth.error;

  const leads = await db.lead.findMany({ include: { customer: true, assignedStaff: true }, orderBy: { createdAt: "asc" } });

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
