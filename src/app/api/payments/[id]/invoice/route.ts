import { jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { leadReference } from "@/lib/leads/reference";
import { paymentInvoiceAmounts, renderInvoicePdf } from "@/lib/invoices/render-invoice";
import { getInvoiceCompanyDetails } from "@/lib/invoices/company-config";
import { ensureInvoiceNumber } from "@/lib/invoices/invoice-number";

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
    include: { booking: { include: { customer: true, lead: true } } },
  });
  if (!payment) return jsonError(404, "Payment not found.");
  const scopeError = assertServiceAccess(auth.session, payment.booking.lead.serviceType);
  if (scopeError) return scopeError;
  if (payment.status !== "SUCCESS") {
    return jsonError(409, "An invoice is only available for a successful payment.");
  }

  // Same line/amount computation as buildInvoicePdfForPayment (this route
  // fetches the payment itself so it can tell a 404 apart from a 409).
  // Derived from what was actually charged on this payment, not today's
  // config — a rate change later shouldn't rewrite a historical invoice.
  const company = await getInvoiceCompanyDetails();

  const pdf = await renderInvoicePdf({
    invoiceNumber: await ensureInvoiceNumber(payment),
    issuedAt: payment.updatedAt,
    bookingId: payment.booking.bookingId,
    leadReference: leadReference(payment.booking.lead),
    customerName: payment.booking.customer.name,
    customerMobile: payment.booking.customer.mobile,
    customerEmail: payment.booking.customer.email,
    ...paymentInvoiceAmounts(payment),
    couponCode: payment.couponCode,
    company,
  });

  const disposition = new URL(request.url).searchParams.get("inline") === "1" ? "inline" : "attachment";

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="invoice-${payment.booking.bookingId}.pdf"`,
    },
  });
}
