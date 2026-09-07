import { jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { formatLeadReference } from "@/lib/leads/reference";
import { renderInvoicePdf } from "@/lib/invoices/render-invoice";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requirePermission("payments.view");
  if (auth.error) return auth.error;

  const { id } = await params;

  const payment = await db.payment.findUnique({
    where: { id },
    include: { booking: { include: { customer: true, lead: true } } },
  });
  if (!payment) return jsonError(404, "Payment not found.");
  if (payment.status !== "SUCCESS") {
    return jsonError(409, "An invoice is only available for a successful payment.");
  }

  const baseFare = Number(payment.amount);
  const gstAmount = Number(payment.gstAmount);
  const gatewayFee = Number(payment.gatewayFee);
  const total = baseFare + gstAmount + gatewayFee;
  // Derived from what was actually charged on this payment, not today's
  // config — a rate change later shouldn't rewrite a historical invoice.
  const gstRatePercent = baseFare > 0 ? (gstAmount / baseFare) * 100 : 0;

  const pdf = await renderInvoicePdf({
    invoiceNumber: `INV-${payment.id.slice(-8).toUpperCase()}`,
    issuedAt: payment.updatedAt,
    bookingId: payment.booking.bookingId,
    leadReference: formatLeadReference(payment.booking.lead.serviceType, payment.booking.leadId),
    customerName: payment.booking.customer.name,
    customerMobile: payment.booking.customer.mobile,
    customerEmail: payment.booking.customer.email,
    baseFare,
    gstAmount,
    gstRatePercent,
    gatewayFee,
    total,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${payment.booking.bookingId}.pdf"`,
    },
  });
}
