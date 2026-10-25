import { nonTaxableQuotationAmount } from "../invoices/invoice-document";
import { effectiveGstRate, serviceInvoiceFee } from "../invoices/service-fee";
import type { Booking, Customer, Lead, Quotation } from "../../generated/prisma/client";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { getTaxFeeRates } from "../settings/tax-fee-config";
import { unpaidAcceptedProtectionPlans } from "./create-payment";

function roundToPaise(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Step 51 (Internal Dashboard Merged §8) — the Bank Transfer counterpart to
 * `createPendingPayment`: same GST computation (tax applies regardless of
 * collection method), but no gateway involved at all — gatewayFee is
 * always 0, and there's no gatewayRef/paymentLink/linkExpiresAt to
 * generate. Stays PENDING until a staff member uploads a slip
 * (POST /api/payments/[id]/bank-slip) and a separate approver confirms it
 * (POST /api/payments/[id]/approve-bank-transfer, gated by
 * payments.approve) — see that route for the actual PENDING -> SUCCESS
 * transition, which reuses the exact same `completePaymentSuccess()` every
 * other payment path already goes through.
 */
export async function createPendingBankTransferPayment(input: {
  booking: Booking & { customer: Customer; lead: Lead };
  quotation: Quotation;
  actor: { byUserId?: string; label: string };
}) {
  const { booking, quotation, actor } = input;

  // P12 — Protection Plans the customer chose are part of the same payment.
  const protectionPlans = await unpaidAcceptedProtectionPlans(booking.id);
  const amount = roundToPaise(Number(quotation.sellingPrice) + protectionPlans.amount);
  const couponDiscount = Number(quotation.couponDiscount ?? 0);
  const netAmount = Math.max(0, amount - couponDiscount);
  const { gstRate: defaultGstRate } = await getTaxFeeRates();
  // Client doc 2026-10-20 (F2/F3) — the service's configured invoice fee is the taxable part, as for gateway payments.
  const passengerCount = await db.bookingPassenger.count({ where: { bookingId: booking.id } });
  const configured = await serviceInvoiceFee(booking.lead.serviceType, passengerCount || booking.lead.paxCount || 1);
  const gstRate = effectiveGstRate(defaultGstRate, configured.gstRate);
  const invoiceServiceFee = configured.fee === null ? null : roundToPaise(Math.min(configured.fee, Math.max(0, netAmount - protectionPlans.amount)));
  // No GST on the Govt./Airline/Vendor fee (and Visa Change / Extension fines) — same rule as gateway payments.
  const gstAmount = roundToPaise(
    (invoiceServiceFee !== null ? invoiceServiceFee + protectionPlans.amount : Math.max(0, netAmount - nonTaxableQuotationAmount(booking.lead.serviceType, quotation))) * gstRate
  );

  return db.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        bookingId: booking.id,
        amount,
        gstAmount,
        invoiceServiceFee,
        gatewayFee: 0,
        couponId: quotation.couponId,
        couponCode: quotation.couponCode,
        couponDiscount: quotation.couponId ? couponDiscount : undefined,
        status: "PENDING",
        method: "BANK_TRANSFER",
        protectionPlanAmount: protectionPlans.amount,
      },
    });
    if (protectionPlans.ids.length > 0) {
      await tx.protectionPlan.updateMany({ where: { id: { in: protectionPlans.ids } }, data: { paymentId: created.id } });
    }

    await writeAudit(tx, {
      entityType: "Payment",
      entityId: created.id,
      action: "CREATE",
      byUserId: actor.byUserId,
      note: `Bank-transfer payment created for booking ${booking.id} — total ₹${roundToPaise(netAmount + gstAmount)}${quotation.couponId ? ` (coupon ${quotation.couponCode} applied, -₹${couponDiscount})` : ""} (${actor.label})`,
    });

    return created;
  });
}
