import type { Booking, Customer, Lead, Quotation } from "../../generated/prisma/client";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { getTaxFeeRates } from "../settings/tax-fee-config";
import { getServiceTimelineRules } from "../settings/service-timeline-config";
import { getPaymentGateway } from "./get-gateway";
import { formatLeadReference } from "../leads/reference";

/** Fallback when the service has no configured `paymentDeadlineHours` (Step 42) — the original hardcoded value, unchanged for every service until an Admin opts in. */
const DEFAULT_PAYMENT_LINK_VALIDITY_HOURS = 24;

function roundToPaise(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Computes GST/gateway fee from the (coupon-adjusted) selected quotation,
 * asks the active payment gateway for a link, and stores a PENDING Payment.
 * Shared by the staff route (POST /api/bookings/[id]/payments) and the
 * website's pay-right-after-the-form checkout, so both price and audit
 * payments identically. Callers do their own precondition checks (booking
 * pending, no other pending payment, quote not expired).
 */
export async function createPendingPayment(input: {
  booking: Booking & { customer: Customer; lead: Lead };
  quotation: Quotation;
  actor: { byUserId?: string; label: string };
}) {
  const { booking, quotation, actor } = input;

  const amount = Number(quotation.sellingPrice);
  // CRM.md §10: "...− Coupon + Gateway Charge = Customer Payable." GST and the
  // gateway fee are computed on the amount AFTER the coupon discount.
  const couponDiscount = Number(quotation.couponDiscount ?? 0);
  const netAmount = Math.max(0, amount - couponDiscount);
  const { gstRate, gatewayFeeRate } = await getTaxFeeRates();
  const gstAmount = roundToPaise(netAmount * gstRate);
  const gatewayFee = roundToPaise(netAmount * gatewayFeeRate);
  const totalAmount = roundToPaise(netAmount + gstAmount + gatewayFee);

  // Step 42 (Admin FINAL handover §6, "payment deadline") — per-service
  // configurable, falling back to the original hardcoded 24h when unset.
  const { paymentDeadlineHours } = await getServiceTimelineRules(booking.lead.serviceType);
  const linkExpiresAt = new Date(Date.now() + (paymentDeadlineHours ?? DEFAULT_PAYMENT_LINK_VALIDITY_HOURS) * 60 * 60 * 1000);

  const gateway = getPaymentGateway();
  // Gateway failures are audited (so the Admin integrations dashboard can show
  // a "last error") and then rethrown — callers decide how to surface them.
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

  return db.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        bookingId: booking.id,
        amount,
        gstAmount,
        gatewayFee,
        couponId: quotation.couponId,
        couponCode: quotation.couponCode,
        couponDiscount: quotation.couponId ? couponDiscount : undefined,
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
      byUserId: actor.byUserId,
      note: `Payment link created for booking ${booking.id} via ${gateway.providerName} — total ₹${totalAmount}${quotation.couponId ? ` (coupon ${quotation.couponCode} applied, -₹${couponDiscount})` : ""} (${actor.label})`,
    });

    return created;
  });
}
