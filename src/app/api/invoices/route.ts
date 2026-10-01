import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { invoiceQuerySchema } from "@/lib/invoices/invoice-query";
import { fetchInvoicePayments, loadInvoiceSet, toInvoiceListItem } from "@/lib/invoices/invoice-register";

/**
 * Invoice History list — SUCCESS payments (tax invoices) in the caller's
 * service scope. `summary` covers the whole filtered set, not just the page.
 * Never returns vendorCost/margin.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("payments.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = invoiceQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }
  const query = parsed.data;

  try {
    const { invoices, summary } = await loadInvoiceSet(auth.session, query);
    const pageIds = invoices.slice((query.page - 1) * query.pageSize, query.page * query.pageSize).map((invoice) => invoice.id);
    const payments = await fetchInvoicePayments(pageIds);

    return jsonSuccess({
      items: payments.map(toInvoiceListItem),
      total: summary.count,
      page: query.page,
      pageSize: query.pageSize,
      summary,
    });
  } catch (error) {
    console.error("[api/invoices] list failed", error);
    return jsonError(500, "Couldn't load invoices. Please try again.");
  }
}
