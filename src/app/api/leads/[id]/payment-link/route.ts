import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { describeError } from "@/lib/api/describe-error";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { writeAudit } from "@/lib/audit/log";
import { createAutoCheckout } from "@/lib/checkout/create-auto-checkout";
import { priceLeadForDirectPayment } from "@/lib/checkout/lead-direct-payment";
import { PaymentGatewayConfigError } from "@/lib/payments/get-gateway";
import { siteConfig } from "@/lib/site-config";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** What the lead would be charged — shown on the button before staff create the link. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("payments.edit");
  if (auth.error) return auth.error;
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id }, select: { serviceType: true, details: true, paxCount: true } });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(auth.session, lead.serviceType);
  if (scopeError) return scopeError;
  const price = await priceLeadForDirectPayment(lead);
  return jsonSuccess(price.ok ? { available: true, totalPrice: price.totalPrice } : { available: false, reason: price.error });
}

/**
 * Client corrections 2026-10-05 §7/§16 — New Visa / OTB / Return Ticket:
 * Lead → Direct Payment Link → (payment success) Booking. Creates the
 * auto-priced quotation, the pending booking (same reference as the lead)
 * and a gateway payment link at the Admin-configured price; the booking only
 * becomes active once the payment succeeds. Refused when the lead already
 * has an active booking or its price isn't configured.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("payments.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  const lead = await db.lead.findUnique({
    where: { id },
    select: { id: true, serviceType: true, details: true, paxCount: true, bookings: { where: { status: { not: "CANCELLED" } }, select: { id: true } } },
  });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(session, lead.serviceType);
  if (scopeError) return scopeError;
  if (lead.bookings.length > 0) {
    return jsonError(409, "This lead already has a booking — create or copy the payment link from the booking.");
  }

  const price = await priceLeadForDirectPayment(lead);
  if (!price.ok) return jsonError(409, price.error);

  try {
    const checkout = await createAutoCheckout({
      leadId: lead.id,
      serviceType: price.serviceType,
      totalPrice: price.totalPrice,
      vendorCost: price.vendorCost,
      invoiceLines: price.invoiceLines,
      actorLabel: `payment link from lead (by ${session.name})`,
    });
    if (!checkout) return jsonError(409, "There's nothing to charge for this lead.");
    await db.$transaction((tx) =>
      writeAudit(tx, {
        entityType: "Lead",
        entityId: lead.id,
        action: "PAYMENT_LINK_CREATED",
        byUserId: session.id,
        note: `Direct payment link created for ₹${price.totalPrice.toLocaleString("en-IN")} (by ${session.name})`,
      })
    );
    return jsonSuccess({ bookingId: checkout.bookingId, payUrl: `${siteConfig.url}/pay/${checkout.token}`, totalPrice: price.totalPrice }, 201);
  } catch (error) {
    if (error instanceof PaymentGatewayConfigError) return jsonError(503, "The payment gateway isn't configured. Contact an Admin.");
    console.error("[api/leads/payment-link] failed", describeError(error));
    return jsonError(500, "Couldn't create the payment link. Please try again.");
  }
}
