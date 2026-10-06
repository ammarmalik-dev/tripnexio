import type { Booking, Customer, Lead, Quotation } from "../../generated/prisma/client";
import type { ServiceType } from "../../generated/prisma/enums";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { getTaxFeeRates } from "../settings/tax-fee-config";
import { getServiceTimelineRules } from "../settings/service-timeline-config";
import { getDefaultPaymentLinkHours } from "../settings/system-config";
import { getPaymentGateway } from "./get-gateway";
import { leadReference } from "../leads/reference";
import { siteConfig } from "../site-config";

/** Fallback when the service has no configured `paymentDeadlineHours` (Step 42) — the original hardcoded value, unchanged for every service until an Admin opts in. */
export const DEFAULT_PAYMENT_LINK_VALIDITY_HOURS = 24;

/**
 * P24 — the one place a payment link's validity is decided:
 * service paymentDeadlineHours (Admin → Timelines) ?? SystemConfig.defaultPaymentLinkHours
 * (Admin → Payment Gateway) ?? DEFAULT_PAYMENT_LINK_VALIDITY_HOURS. Uses the
 * global db — call it outside any transaction.
 */
export async function resolvePaymentLinkValidityHours(serviceType: ServiceType): Promise<number> {
  const { paymentDeadlineHours } = await getServiceTimelineRules(serviceType);
  if (paymentDeadlineHours != null) return paymentDeadlineHours;
  return (await getDefaultPaymentLinkHours()) ?? DEFAULT_PAYMENT_LINK_VALIDITY_HOURS;
}

function roundToPaise(value: number): number {
  return Math.round(value * 100) / 100;
}

interface CreateGatewayPaymentInput {
  booking: Booking & { customer: Customer; lead: Lead };
  actor: { byUserId?: string; label: string };
  /** Pre-discount base amount — GST/gatewayFee are computed on `baseAmount - couponDiscount`. */
  baseAmount: number;
  couponId?: string | null;
  couponCode?: string | null;
  couponDiscount?: number;
  purpose: "PRIMARY" | "EXTRA";
  /** EXTRA only — the staff-entered reason, stored on Payment.description and used in the gateway link's own description. */
  description?: string;
  /** P12 — Protection Plans this payment charges for; their prices are already part of `baseAmount`. */
  protectionPlans?: { ids: string[]; amount: number };
  /** Client corrections 2026-10-05 — the government / airline fee inside `baseAmount`; GST is charged on the rest only. */
  nonTaxableAmount?: number;
}

/**
 * Step 52 — the shared "resolve tax/fee, ask the gateway for a link,
 * store the Payment row" core, extracted so `createPendingPayment`
 * (PRIMARY, quotation-priced) and `createExtraPayment` (EXTRA,
 * staff-entered amount) go through the exact same gateway/GST logic
 * instead of two parallel implementations.
 */
async function createGatewayPayment(input: CreateGatewayPaymentInput) {
  const { booking, actor, baseAmount, couponId, couponCode, purpose, description, protectionPlans } = input;
  const couponDiscount = input.couponDiscount ?? 0;

  // CRM.md §10: "...− Coupon + Gateway Charge = Customer Payable." GST and the
  // gateway fee are computed on the amount AFTER the coupon discount.
  const netAmount = Math.max(0, baseAmount - couponDiscount);
  const { gstRate, gatewayFeeRate } = await getTaxFeeRates();
  const taxableAmount = Math.max(0, netAmount - (input.nonTaxableAmount ?? 0));
  const gstAmount = roundToPaise(taxableAmount * gstRate);
  const gatewayFee = roundToPaise(netAmount * gatewayFeeRate);
  const totalAmount = roundToPaise(netAmount + gstAmount + gatewayFee);

  // Step 42 (Admin FINAL handover §6, "payment deadline") — per-service
  // configurable; P24 adds the Admin → Payment Gateway system-wide default
  // (SystemConfig.defaultPaymentLinkHours) before the original 24h fallback.
  // Read here, BEFORE this function opens its own transaction below — every
  // caller invokes createPendingPayment/createExtraPayment outside any
  // transaction, so using the global db is safe.
  const validityHours = await resolvePaymentLinkValidityHours(booking.lead.serviceType);
  const linkExpiresAt = new Date(Date.now() + validityHours * 60 * 60 * 1000);

  const gateway = getPaymentGateway();
  const reference = leadReference(booking.lead);
  // Gateway failures are audited (so the Admin integrations dashboard can show
  // a "last error") and then rethrown — callers decide how to surface them.
  let gatewayRef: string;
  let paymentLink: string;
  try {
    const linkResult = await gateway.createPaymentLink({
      amountInRupees: totalAmount,
      description: purpose === "EXTRA" ? `TripNexio ${reference} — ${description ?? "Extra Payment"}` : `TripNexio ${reference}`,
      customerName: booking.customer.name,
      customerMobile: booking.customer.mobile,
      customerEmail: booking.customer.email,
      notes: { bookingId: booking.id, leadId: booking.leadId, purpose },
      expiresAt: linkExpiresAt,
      ...(booking.customerToken ? { callbackUrl: `${siteConfig.url}/pay/${booking.customerToken}` } : {}),
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
        amount: baseAmount,
        gstAmount,
        gatewayFee,
        couponId,
        couponCode,
        couponDiscount: couponId ? couponDiscount : undefined,
        status: "PENDING",
        gatewayRef,
        paymentLink,
        linkExpiresAt,
        purpose,
        description: purpose === "EXTRA" ? description : undefined,
        protectionPlanAmount: protectionPlans?.amount ?? 0,
      },
    });

    // P12 — link the plans; they become PURCHASED when this payment succeeds.
    if (protectionPlans && protectionPlans.ids.length > 0) {
      await tx.protectionPlan.updateMany({ where: { id: { in: protectionPlans.ids } }, data: { paymentId: created.id } });
    }

    await writeAudit(tx, {
      entityType: "Payment",
      entityId: created.id,
      action: "CREATE",
      byUserId: actor.byUserId,
      note:
        purpose === "EXTRA"
          ? `Extra payment link created for booking ${booking.id} — total ₹${totalAmount} — reason: ${description} (${actor.label})`
          : `Payment link created for booking ${booking.id} via ${gateway.providerName} — total ₹${totalAmount}${couponId ? ` (coupon ${couponCode} applied, -₹${couponDiscount})` : ""}${protectionPlans?.amount ? ` (includes Protection Plan ₹${protectionPlans.amount})` : ""} (${actor.label})`,
    });

    return created;
  });
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
  const protectionPlans = await unpaidAcceptedProtectionPlans(booking.id);
  return createGatewayPayment({
    booking,
    actor,
    baseAmount: Number(quotation.sellingPrice) + protectionPlans.amount,
    couponId: quotation.couponId,
    couponCode: quotation.couponCode,
    couponDiscount: Number(quotation.couponDiscount ?? 0),
    purpose: "PRIMARY",
    protectionPlans,
    nonTaxableAmount: Number(quotation.governmentFee ?? 0),
  });
}

/**
 * P12 — plans the customer chose (terms accepted) that no live payment covers
 * yet: never linked, or linked to a payment that failed/expired. Their prices
 * are added to the next payment as the "Protection Plan" line.
 */
export async function unpaidAcceptedProtectionPlans(bookingId: string): Promise<{ ids: string[]; amount: number }> {
  const plans = await db.protectionPlan.findMany({
    where: {
      bookingId,
      status: "TERMS_ACCEPTED",
      OR: [{ paymentId: null }, { payment: { status: { in: ["FAILED", "EXPIRED"] } } }],
    },
    select: { id: true, price: true },
  });
  return { ids: plans.map((plan) => plan.id), amount: roundToPaise(plans.reduce((sum, plan) => sum + Number(plan.price), 0)) };
}

/**
 * P12 — a later staff purchase of Protection Plan(s) on an already-paid
 * booking: its own EXTRA payment on the same booking, charged only the plan
 * prices, shown on the invoice as "Protection Plan".
 */
export async function createProtectionPlanPayment(input: {
  booking: Booking & { customer: Customer; lead: Lead };
  plans: { id: string; price: number }[];
  actor: { byUserId?: string; label: string };
}) {
  const { booking, plans, actor } = input;
  const amount = roundToPaise(plans.reduce((sum, plan) => sum + plan.price, 0));
  return createGatewayPayment({
    booking,
    actor,
    baseAmount: amount,
    purpose: "EXTRA",
    description: "Protection Plan",
    protectionPlans: { ids: plans.map((plan) => plan.id), amount },
  });
}

/**
 * Step 52 (Internal Dashboard Merged §9) — an add-on charge against an
 * already-existing Booking, decoupled from any Quotation (the booking is
 * already confirmed/priced; this is a later extra fee, e.g. an additional
 * baggage charge). No coupon support — a coupon is a pricing-time concept
 * tied to the original Quotation, not something that applies to a
 * standalone add-on. Reuses the exact same gateway/GST logic as the
 * primary payment path via `createGatewayPayment`.
 */
export async function createExtraPayment(input: {
  booking: Booking & { customer: Customer; lead: Lead };
  amount: number;
  description: string;
  actor: { byUserId?: string; label: string };
}) {
  const { booking, amount, description, actor } = input;
  return createGatewayPayment({ booking, actor, baseAmount: amount, purpose: "EXTRA", description });
}
