import { jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
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
  const scopeError = assertServiceAccess(auth.session, payment.booking.lead.serviceType);
  if (scopeError) return scopeError;
  if (payment.status !== "SUCCESS") {
    return jsonError(409, "An invoice is only available for a successful payment.");
  }

  const baseFare = Number(payment.amount);
  // Step 22 (audit §7.8) — coupon discount reduces the base GST/gateway
  // fee are computed on; see render-invoice.ts's buildInvoicePdfForPayment
  // for the identical computation (this route duplicates it rather than
  // calling that one, so it can tell a 404 (missing) apart from a 409
  // (non-SUCCESS) — buildInvoicePdfForPayment collapses both to null).
  const couponDiscount = Number(payment.couponDiscount ?? 0);
  const netAmount = baseFare - couponDiscount;
  const gstAmount = Number(payment.gstAmount);
  const gatewayFee = Number(payment.gatewayFee);
  const total = netAmount + gstAmount + gatewayFee;
  // Derived from what was actually charged on this payment, not today's
  // config — a rate change later shouldn't rewrite a historical invoice.
  const gstRatePercent = netAmount > 0 ? (gstAmount / netAmount) * 100 : 0;

  const pdf = await renderInvoicePdf({
    invoiceNumber: `INV-${payment.id.slice(-8).toUpperCase()}`,
    issuedAt: payment.updatedAt,
    bookingId: payment.booking.bookingId,
    leadReference: formatLeadReference(payment.booking.lead.serviceType, payment.booking.leadId),
    customerName: payment.booking.customer.name,
    customerMobile: payment.booking.customer.mobile,
    customerEmail: payment.booking.customer.email,
    baseFare,
    couponCode: payment.couponCode,
    couponDiscount,
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
