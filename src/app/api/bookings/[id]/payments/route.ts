import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { getTaxFeeRates } from "@/lib/settings/tax-fee-config";
import { getPaymentGateway } from "@/lib/payments/get-gateway";
import { isExpiredNow, syncExpiredQuotations } from "@/lib/quotations/sync-expiry";
import { formatLeadReference } from "@/lib/leads/reference";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GST/gateway-fee rates come from the admin-managed TaxFeeConfig singleton
// (see src/lib/settings/tax-fee-config.ts) — no longer hard-coded here.
const PAYMENT_LINK_VALIDITY_MS = 24 * 60 * 60 * 1000;

function roundToPaise(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("payments.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id: bookingId } = await params;

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      lead: { include: { quotations: { where: { isSelected: true } } } },
    },
  });
  if (!booking) return jsonError(404, "Booking not found.");
  if (booking.status !== "PENDING") {
    return jsonError(409, "This booking is no longer pending — a payment can't be created for it.");
  }

  const existingPending = await db.payment.findFirst({ where: { bookingId, status: "PENDING" } });
  if (existingPending) {
    return jsonError(409, "A pending payment already exists for this booking.");
  }

  const [selectedQuotation] = await syncExpiredQuotations(booking.lead.quotations);
  if (!selectedQuotation) {
    return jsonError(409, "No selected quotation found for this booking's lead.");
  }

  // Flight quotes have a tight (<=30 min) validity window (see
  // src/lib/quotations/pricing.ts) that can lapse between booking creation
  // and payment creation — re-check it right before generating a payment
  // link, don't just trust that it was valid when the booking was made.
  if (booking.lead.serviceType === "FLIGHT_SPECIAL_FARE" && isExpiredNow(selectedQuotation)) {
    return jsonError(409, "This flight quote has expired. Build a new quote for this lead before creating a payment.");
  }

  const amount = Number(selectedQuotation.sellingPrice);
  // Step 22 (audit §3.2/§4.2/§7.8) — CRM.md §10: "...− Coupon + Gateway
  // Charge = Customer Payable." The coupon was already resolved and
  // snapshotted onto the Quotation when it was applied; GST/gateway fee
  // are computed on the amount AFTER the discount, not the original.
  const couponDiscount = Number(selectedQuotation.couponDiscount ?? 0);
  const netAmount = Math.max(0, amount - couponDiscount);
  const { gstRate, gatewayFeeRate } = await getTaxFeeRates();
  const gstAmount = roundToPaise(netAmount * gstRate);
  const gatewayFee = roundToPaise(netAmount * gatewayFeeRate);
  const totalAmount = roundToPaise(netAmount + gstAmount + gatewayFee);
  const linkExpiresAt = new Date(Date.now() + PAYMENT_LINK_VALIDITY_MS);

  const gateway = getPaymentGateway();
  // Step 25 (audit §4.5) — the payment gateway integration had no failure
  // visibility anywhere (unlike email/WhatsApp's EMAIL_FAILED/WHATSAPP_FAILED
  // audit rows) — a createPaymentLink() error just threw uncaught, no signal
  // for the Admin integrations dashboard to show as "last error." This
  // records the same real signal, without changing the existing throw/500
  // behavior a caller-side failure already had.
  let gatewayRef: string;
  let paymentLink: string;
  try {
    const linkResult = await gateway.createPaymentLink({
      amountInRupees: totalAmount,
      description: `TripNexio ${formatLeadReference(booking.lead.serviceType, booking.leadId)}`,
      customerName: booking.customer.name,
      customerMobile: booking.customer.mobile,
      customerEmail: booking.customer.email,
      notes: { bookingId: booking.id, leadId: booking.leadId },
      expiresAt: linkExpiresAt,
    });
    gatewayRef = linkResult.gatewayRef;
    paymentLink = linkResult.paymentLink;
  } catch (error) {
    await writeAudit(db, {
      entityType: "Booking",
      entityId: booking.id,
      action: "PAYMENT_GATEWAY_ERROR",
      note: `${gateway.providerName} createPaymentLink failed: ${error instanceof Error ? error.message : String(error)}`,
    });
    throw error;
  }

  const payment = await db.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        bookingId,
        amount,
        gstAmount,
        gatewayFee,
        couponId: selectedQuotation.couponId,
        couponCode: selectedQuotation.couponCode,
        couponDiscount: selectedQuotation.couponId ? couponDiscount : undefined,
        status: "PENDING",
        gatewayRef,
        paymentLink,
        linkExpiresAt,
      },
    });

    await writeAudit(tx, {
      entityType: "Payment",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Payment link created for booking ${bookingId} via ${gateway.providerName} — total ₹${totalAmount}${selectedQuotation.couponId ? ` (coupon ${selectedQuotation.couponCode} applied, -₹${couponDiscount})` : ""} (by ${session.name})`,
    });

    return created;
  });

  return jsonSuccess(payment, 201);
}
