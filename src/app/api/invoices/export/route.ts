import type { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { csvExportResponse, EXPORT_QUERY_TAKE, exportFiltersFromSearchParams } from "@/lib/csv/export-guard";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { invoiceQuerySchema } from "@/lib/invoices/invoice-query";
import { fetchInvoicePayments, loadInvoiceSet, toInvoiceListItem, type InvoiceListItem } from "@/lib/invoices/invoice-register";
import { roundMoney } from "@/lib/invoices/invoice-filters";

const METHOD_LABELS: Record<InvoiceListItem["method"], string> = { GATEWAY: "Payment Gateway", BANK_TRANSFER: "Bank Transfer" };
const PURPOSE_LABELS: Record<InvoiceListItem["purpose"], string> = { PRIMARY: "Primary", EXTRA: "Extra" };
const REFUND_STATE_LABELS: Record<InvoiceListItem["refundState"], string> = {
  none: "Not refunded",
  partial: "Partially refunded",
  full: "Fully refunded",
};

/**
 * Invoice History — CSV invoice register of the current filters (pagination
 * ignored). Row-capped and audited by csvExportResponse like every export.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("payments.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = invoiceQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }

  try {
    const { invoices } = await loadInvoiceSet(auth.session, parsed.data);
    const payments = await fetchInvoicePayments(invoices.slice(0, EXPORT_QUERY_TAKE).map((invoice) => invoice.id));
    const rows = payments.map(toInvoiceListItem);

    const filters = exportFiltersFromSearchParams(searchParams);
    delete filters.page;
    delete filters.pageSize;

    return await csvExportResponse({
      exportName: "invoices",
      filename: `invoices-${new Date().toISOString().slice(0, 10)}.csv`,
      rows,
      byUserId: auth.session.id,
      filters,
      columns: [
        { key: "invoiceNumber", header: "Invoice Number", value: (row) => row.invoiceNumber ?? "" },
        { key: "issuedAt", header: "Invoice Date", value: (row) => row.issuedAt },
        { key: "bookingRef", header: "Booking ID", value: (row) => row.bookingRef },
        { key: "leadReference", header: "Lead Reference", value: (row) => row.leadReference },
        { key: "serviceType", header: "Service", value: (row) => SERVICE_TYPE_LABELS[row.serviceType] },
        { key: "customerName", header: "Customer Name", value: (row) => row.customer.name },
        { key: "customerMobile", header: "Customer Mobile", value: (row) => row.customer.mobile },
        { key: "customerEmail", header: "Customer Email", value: (row) => row.customer.email ?? "" },
        { key: "method", header: "Payment Method", value: (row) => METHOD_LABELS[row.method] },
        { key: "purpose", header: "Purpose", value: (row) => PURPOSE_LABELS[row.purpose] },
        { key: "baseAmount", header: "Base Amount", value: (row) => row.baseAmount },
        { key: "protectionPlanAmount", header: "Protection Plan (in base)", value: (row) => row.protectionPlanAmount },
        { key: "couponCode", header: "Coupon Code", value: (row) => row.couponCode ?? "" },
        { key: "couponDiscount", header: "Coupon Discount", value: (row) => row.couponDiscount },
        { key: "gstAmount", header: "GST", value: (row) => row.gstAmount },
        { key: "gatewayFee", header: "Gateway Fee", value: (row) => row.gatewayFee },
        { key: "total", header: "Invoice Total", value: (row) => row.total },
        { key: "refundedAmount", header: "Refunded", value: (row) => row.refundedAmount },
        { key: "refundState", header: "Refund Status", value: (row) => REFUND_STATE_LABELS[row.refundState] },
        { key: "net", header: "Net", value: (row) => roundMoney(row.total - row.refundedAmount) },
      ],
    });
  } catch (error) {
    console.error("[api/invoices/export] export failed", error);
    return jsonError(500, "Couldn't export invoices. Please try again.");
  }
}
