import { jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { buildInvoicePdfForPayment } from "@/lib/invoices/render-invoice";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** `?inline=1` serves the PDF inline (the Invoice History "View" action opens it in a new tab); default stays a download. */
export async function GET(request: Request, { params }: RouteParams) {
  const auth = await requirePermission("payments.view");
  if (auth.error) return auth.error;

  const { id } = await params;

  const payment = await db.payment.findUnique({
    where: { id },
    include: { booking: { include: { lead: true } } },
  });
  if (!payment) return jsonError(404, "Payment not found.");
  const scopeError = assertServiceAccess(auth.session, payment.booking.lead.serviceType);
  if (scopeError) return scopeError;
  if (payment.status !== "SUCCESS") {
    return jsonError(409, "An invoice is only available for a successful payment.");
  }

  const invoice = await buildInvoicePdfForPayment(payment.id);
  if (!invoice) return jsonError(409, "An invoice is only available for a successful payment.");
  const pdf = invoice.pdf;

  const disposition = new URL(request.url).searchParams.get("inline") === "1" ? "inline" : "attachment";

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="invoice-${payment.booking.bookingId}.pdf"`,
    },
  });
}
