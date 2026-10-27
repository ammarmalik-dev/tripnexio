import type { Booking, Customer, Lead, Quotation } from "../../generated/prisma/client";
import type { ServiceType } from "../../generated/prisma/enums";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { getTaxFeeRates } from "../settings/tax-fee-config";
import { getServiceTimelineRules } from "../settings/service-timeline-config";
import { getDefaultPaymentLinkHours } from "../settings/system-config";
import { usableGateways, type UsableGateway } from "./accounts";
import { notifyPaymentLinkReady } from "./notify-payment-link";
import { effectiveGstRate, paymentServiceFeeSplit, serviceInvoiceFee } from "../invoices/service-fee";
import { leadReference } from "../leads/reference";
import { siteConfig } from "../site-config";
import { urgentDeadlineFromDetails } from "../visa-extension/rules";

/** Fallback when the service has no configured `paymentDeadlineHours` (Step 42) — the original hardcoded value, unchanged for every service until an Admin opts in. */
export const DEFAULT_PAYMENT_LINK_VALIDITY_HOURS = 24;

/** Direct-payment services whose payment link never expires (client 2026-10-14). */
export const NO_EXPIRY_LINK_SERVICES: ReadonlySet<ServiceType> = new Set<ServiceType>(["NEW_VISA", "OTB", "RETURN_TICKET"]);

/**
 * P24 — the one place a payment link's validity is decided (null = no expiry):
 * service paymentDeadlineHours (Admin → Timelines) ?? SystemConfig.defaultPaymentLinkHours
 * (Admin → Payment Gateway) ?? DEFAULT_PAYMENT_LINK_VALIDITY_HOURS. Uses the
 * global db — call it outside any transaction.
 */
export async function resolvePaymentLinkValidityHours(serviceType: ServiceType, countryId?: string | null): Promise<number | null> {
  // Client 2026-10-14 — "do not set a time limit on OTB, Return Ticket and New Visa payment links".
  if (NO_EXPIRY_LINK_SERVICES.has(serviceType)) return null;
  // Admin handover §6 — the lead's country timeline (if any) overrides the service value.
  const { paymentDeadlineHours } = await getServiceTimelineRules(serviceType, countryId);
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
  /** The WhatsApp bot sends the Pay Now button in its own reply — no second WhatsApp message (client 2026-10-14). */
  skipWhatsAppNotice?: boolean;
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
  const { gstRate: defaultGstRate, gatewayFeeRate, absorbedGatewayFeeRate } = await getTaxFeeRates();
  // Client doc 2026-10-20 (F2/F3) / 2026-10-27 (C5/E4/F2) — GST on the Admin-set invoice service fee only (plus a
  // Protection Plan, a taxable service); the rest of the price is the Govt./Airline/Vendor fee. No fee configured →
  // service fee 0, no GST. An extra payment (fare difference, fines) is a pass-through fee.
  const passengerCount = await db.bookingPassenger.count({ where: { bookingId: booking.id } });
  const configured = await serviceInvoiceFee(booking.lead.serviceType, passengerCount || booking.lead.paxCount || 1);
  const gstRate = effectiveGstRate(defaultGstRate, configured.gstRate);
  const { invoiceServiceFee, gstAmount } = paymentServiceFeeSplit({
    netAmount,
    planAmount: protectionPlans?.amount ?? 0,
    configuredFee: configured.fee,
    extra: purpose === "EXTRA",
    gstRate,
  });
  const gatewayFee = roundToPaise(netAmount * gatewayFeeRate);
  const totalAmount = roundToPaise(netAmount + gstAmount + gatewayFee);
  // Client doc 2026-10-15 (G5) — not charged to the customer: our expense, on the full amount paid.
  const gatewayFeeAbsorbed = roundToPaise(totalAmount * absorbedGatewayFeeRate);

  // Step 42 (Admin FINAL handover §6, "payment deadline") — per-service
  // configurable; P24 adds the Admin → Payment Gateway system-wide default
  // (SystemConfig.defaultPaymentLinkHours) before the original 24h fallback.
  // Read here, BEFORE this function opens its own transaction below — every
  // caller invokes createPendingPayment/createExtraPayment outside any
  // transaction, so using the global db is safe.
  const validityHours = await resolvePaymentLinkValidityHours(booking.lead.serviceType, booking.lead.countryId);
  const defaultExpiry = validityHours === null ? null : new Date(Date.now() + validityHours * 60 * 60 * 1000);
  // Client 2026-10-28 — an urgent Visa Extension's link closes at its 6 PM deadline, not 24 h later.
  const urgent = booking.lead.serviceType === "VISA_EXTENSION" ? urgentDeadlineFromDetails(booking.lead.details) : null;
  const urgentAt = urgent ? new Date(urgent.at) : null;
  const linkExpiresAt =
    urgentAt && !Number.isNaN(urgentAt.getTime()) && urgentAt.getTime() > Date.now() && (!defaultExpiry || urgentAt < defaultExpiry) ? urgentAt : defaultExpiry;

  const reference = leadReference(booking.lead);
  // Client corrections 2026-10-05 §27 — failover: try each active, configured
  // gateway account in priority order until one issues the link. Every try is
  // kept as attempt history on the ONE Payment created below; failures are
  // audited (Admin integrations dashboard "last error") and, when every
  // account fails, the last error is rethrown — callers decide how to surface it.
  const candidates = await usableGateways();
  const attempts: { accountId: string; succeeded: boolean; errorMessage: string | null }[] = [];
  let issued: { candidate: UsableGateway; gatewayRef: string; paymentLink: string } | null = null;
  let lastError: unknown = null;
  for (const [index, candidate] of candidates.entries()) {
    const label = candidate.account?.label ?? candidate.gateway.providerName;
    try {
      const linkResult = await candidate.gateway.createPaymentLink({
        amountInRupees: totalAmount,
        description: purpose === "EXTRA" ? `TripNexio ${reference} — ${description ?? "Extra Payment"}` : `TripNexio ${reference}`,
        customerName: booking.customer.name,
        customerMobile: booking.customer.mobile,
        customerEmail: booking.customer.email,
        notes: { bookingId: booking.id, leadId: booking.leadId, purpose },
        expiresAt: linkExpiresAt,
        ...(booking.customerToken ? { callbackUrl: `${siteConfig.url}/pay/${booking.customerToken}` } : {}),
      });
      if (candidate.account) attempts.push({ accountId: candidate.account.id, succeeded: true, errorMessage: null });
      issued = { candidate, gatewayRef: linkResult.gatewayRef, paymentLink: linkResult.paymentLink };
      break;
    } catch (error) {
      lastError = error;
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      const hasNext = index < candidates.length - 1;
      if (candidate.account) {
        attempts.push({ accountId: candidate.account.id, succeeded: false, errorMessage: message });
        await db.paymentGatewayAccount.update({
          where: { id: candidate.account.id },
          data: { lastCheckedAt: new Date(), lastCheckOk: false, lastCheckMessage: `Payment link failed: ${message}`.slice(0, 300) },
        });
      }
      await writeAudit(db, {
        entityType: "Booking",
        entityId: booking.id,
        action: hasNext ? "PAYMENT_GATEWAY_FAILOVER" : "PAYMENT_GATEWAY_ERROR",
        note: `${label} createPaymentLink failed: ${message}${hasNext ? ` — failing over to ${candidates[index + 1].account?.label ?? "the next gateway"}` : ""}`,
      });
    }
  }
  if (!issued) {
    if (attempts.length > 0) {
      await db.paymentGatewayAttempt.createMany({ data: attempts.map((attempt) => ({ ...attempt, bookingId: booking.id })) });
    }
    throw lastError ?? new Error("No payment gateway is available.");
  }
  const { gatewayRef, paymentLink } = issued;
  const gateway = issued.candidate.gateway;
  const gatewayAccount = issued.candidate.account;

  const createdPayment = await db.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        bookingId: booking.id,
        amount: baseAmount,
        gstAmount,
        invoiceServiceFee,
        gatewayFee,
        gatewayFeeAbsorbed,
        couponId,
        couponCode,
        couponDiscount: couponId ? couponDiscount : undefined,
        status: "PENDING",
        gatewayRef,
        paymentLink,
        gatewayAccountId: gatewayAccount?.id ?? null,
        linkExpiresAt,
        purpose,
        description: purpose === "EXTRA" ? description : undefined,
        protectionPlanAmount: protectionPlans?.amount ?? 0,
      },
    });

    if (attempts.length > 0) {
      await tx.paymentGatewayAttempt.createMany({ data: attempts.map((attempt) => ({ ...attempt, bookingId: booking.id, paymentId: created.id })) });
    }

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
          : `Payment link created for booking ${booking.id} via ${gatewayAccount?.label ?? gateway.providerName}${attempts.length > 1 ? ` after ${attempts.length - 1} failover(s)` : ""} — total ₹${totalAmount}${couponId ? ` (coupon ${couponCode} applied, -₹${couponDiscount})` : ""}${protectionPlans?.amount ? ` (includes Protection Plan ₹${protectionPlans.amount})` : ""} (${actor.label})`,
    });

    return created;
  });
  // Client testing 2026-10-09 — the customer gets the link on email + WhatsApp (never throws).
  await notifyPaymentLinkReady(createdPayment.id, { skipWhatsApp: input.skipWhatsAppNotice });
  return createdPayment;
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
  skipWhatsAppNotice?: boolean;
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
    skipWhatsAppNotice: input.skipWhatsAppNotice,
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
