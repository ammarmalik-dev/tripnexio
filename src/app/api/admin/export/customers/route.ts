import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { toCsv } from "@/lib/csv/to-csv";

export async function GET() {
  const auth = await requirePermission("data.export");
  if (auth.error) return auth.error;

  const customers = await db.customer.findMany({ orderBy: { createdAt: "asc" } });

  const csv = toCsv(customers, [
    { key: "id", header: "ID", value: (row) => row.id },
    { key: "name", header: "Name", value: (row) => row.name },
    { key: "mobile", header: "Mobile", value: (row) => row.mobile },
    { key: "email", header: "Email", value: (row) => row.email ?? "" },
    { key: "createdAt", header: "Created At", value: (row) => row.createdAt.toISOString() },
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
