import { jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { buildInvoicePdfForQuotation } from "@/lib/invoices/render-invoice";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Step 44 — Proforma Invoice download for a Quotation, the pre-payment
 * counterpart to /api/payments/[id]/invoice (which needs a real SUCCESS
 * payment). Available for any quotation, selected or not, expired or not
 * — a Proforma is just a staff-shareable estimate, not a record of money
 * collected, so none of the Payment route's status gating applies here.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requirePermission("quotations.view");
  if (auth.error) return auth.error;

  const { id } = await params;

  const quotation = await db.quotation.findUnique({ where: { id }, include: { lead: true } });
  if (!quotation) return jsonError(404, "Quotation not found.");
  const scopeError = assertServiceAccess(auth.session, quotation.lead.serviceType);
  if (scopeError) return scopeError;

  const invoice = await buildInvoicePdfForQuotation(id);
  if (!invoice) return jsonError(404, "Quotation not found.");

  return new Response(new Uint8Array(invoice.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="proforma-${invoice.invoiceNumber}.pdf"`,
    },
  });
}
