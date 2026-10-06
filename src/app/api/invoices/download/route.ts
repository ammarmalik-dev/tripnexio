import type { NextRequest } from "next/server";
import { zipSync } from "fflate";
import { jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { writeAudit } from "@/lib/audit/log";
import { exportFiltersFromSearchParams } from "@/lib/csv/export-guard";
import { invoiceQuerySchema } from "@/lib/invoices/invoice-query";
import { fetchInvoicePayments, loadInvoiceSet } from "@/lib/invoices/invoice-register";
import { MAX_INVOICE_ZIP } from "@/lib/invoices/invoice-filters";
import { buildInvoicePdfForPayment } from "@/lib/invoices/render-invoice";

/**
 * Invoice History — one ZIP of the invoice PDFs for the current filters,
 * capped at MAX_INVOICE_ZIP (409 above that, so the screen asks to narrow
 * the filters). Same PDF as GET /api/payments/[id]/invoice; a missing
 * invoice number is assigned (once, persisted) via ensureInvoiceNumber.
 * PDFs are rendered one after another so the request never holds several
 * pooled connections at once. Audited.
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
    if (invoices.length === 0) {
      return jsonError(404, "No invoices match these filters.");
    }
    if (invoices.length > MAX_INVOICE_ZIP) {
      return jsonError(
        409,
        `${invoices.length} invoices match these filters — a bulk download is limited to ${MAX_INVOICE_ZIP}. Narrow the filters (for example the date range) and try again.`
      );
    }

    const payments = await fetchInvoicePayments(invoices.map((invoice) => invoice.id));
    const files: Record<string, Uint8Array> = {};

    for (const payment of payments) {
      const invoice = await buildInvoicePdfForPayment(payment.id);
      if (!invoice) continue;
      const { invoiceNumber, pdf } = invoice;
      let name = `${invoiceNumber.replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`;
      for (let suffix = 2; files[name]; suffix++) name = `${invoiceNumber.replace(/[^A-Za-z0-9._-]/g, "_")}-${suffix}.pdf`;
      files[name] = new Uint8Array(pdf);
    }

    // PDFs are already compressed — store them as-is.
    const zip = zipSync(files, { level: 0 });

    const filters = exportFiltersFromSearchParams(searchParams);
    delete filters.page;
    delete filters.pageSize;
    await writeAudit(db, {
      entityType: "Export",
      entityId: "invoices-zip",
      action: "EXPORT",
      byUserId: auth.session.id,
      note: `Invoice PDF bulk download — ${payments.length} invoice(s); filters: ${
        Object.keys(filters).length === 0 ? "none" : JSON.stringify(filters)
      } (by ${auth.session.name})`,
    });

    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="invoices-${new Date().toISOString().slice(0, 10)}.zip"`,
        "X-Export-Row-Count": String(payments.length),
      },
    });
  } catch (error) {
    console.error("[api/invoices/download] bulk download failed", error);
    return jsonError(500, "Couldn't prepare the invoice download. Please try again.");
  }
}
