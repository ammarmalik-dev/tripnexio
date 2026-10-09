import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { describeError } from "@/lib/api/describe-error";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { writeAudit } from "@/lib/audit/log";
import { createAutoCheckout } from "@/lib/checkout/create-auto-checkout";
import { priceLeadForDirectPayment } from "@/lib/checkout/lead-direct-payment";
import { resolveCouponForQuotation } from "@/lib/coupons/apply";
import { PaymentGatewayConfigError } from "@/lib/payments/get-gateway";
import { siteConfig } from "@/lib/site-config";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const extrasSchema = z.object({
  /** Permitted additional charges on top of the configured price (the configured amount is not a cap). */
  extraCharges: z.number().nonnegative("Can't be negative").max(1_000_000).optional(),
  couponCode: z.string().trim().max(40).optional(),
});

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * What the lead would be charged: the Admin-configured amount, any extra
 * charges and coupon, and the final payable (client testing 2026-10-09 —
 * E1: shown clearly before the link is created).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("payments.edit");
  if (auth.error) return auth.error;
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id }, select: { id: true, serviceType: true, details: true, paxCount: true } });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(auth.session, lead.serviceType);
  if (scopeError) return scopeError;

  const price = await priceLeadForDirectPayment(lead);
  if (!price.ok) return jsonSuccess({ available: false, reason: price.error });

  const searchParams = new URL(request.url).searchParams;
  const extraCharges = Math.max(0, Number(searchParams.get("extraCharges") ?? 0) || 0);
  const couponCode = searchParams.get("couponCode")?.trim() ?? "";
  const gross = round2(price.totalPrice + extraCharges);
  let couponDiscount = 0;
  let couponError: string | null = null;
  if (couponCode) {
    const coupon = await resolveCouponForQuotation(couponCode, lead.serviceType, gross, lead.id);
    if (coupon.ok) couponDiscount = coupon.coupon.discountAmount;
    else couponError = coupon.error;
  }
  return jsonSuccess({
    available: true,
    totalPrice: price.totalPrice,
    extraCharges,
    couponDiscount,
    couponError,
    finalPayable: round2(gross - couponDiscount),
  });
}

/**
 * Client corrections 2026-10-05 §7/§16 — New Visa / OTB / Return Ticket:
 * Lead → Direct Payment Link → (payment success) Booking. Creates the
 * auto-priced quotation, the pending booking (same reference as the lead)
 * and a gateway payment link at the Admin-configured price (+ permitted
 * extra charges, − coupon); the customer is sent the link. Refused when the
 * lead already has an active booking or its price isn't configured.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("payments.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = extrasSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const extraCharges = parsed.data.extraCharges ?? 0;
  const couponCode = parsed.data.couponCode || undefined;

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
      extraCharges,
      couponCode,
      actorLabel: `payment link from lead (by ${session.name})`,
    });
    if (!checkout) return jsonError(409, "There's nothing to charge for this lead.");
    await db.$transaction((tx) =>
      writeAudit(tx, {
        entityType: "Lead",
        entityId: lead.id,
        action: "PAYMENT_LINK_CREATED",
        byUserId: session.id,
        note: `Direct payment link created: configured ₹${price.totalPrice.toLocaleString("en-IN")}${extraCharges > 0 ? ` + extra ₹${extraCharges.toLocaleString("en-IN")}` : ""}${couponCode ? `, coupon ${couponCode.toUpperCase()}` : ""} (by ${session.name})`,
      })
    );
    return jsonSuccess({ bookingId: checkout.bookingId, payUrl: `${siteConfig.url}/pay/${checkout.token}`, totalPrice: price.totalPrice }, 201);
  } catch (error) {
    if (error instanceof PaymentGatewayConfigError) return jsonError(503, "The payment gateway isn't configured. Contact an Admin.");
    // A bad coupon is thrown by createAutoCheckout with a readable message.
    if (couponCode && error instanceof Error && !/prisma|database/i.test(error.message)) return jsonError(400, error.message, { couponCode: [error.message] });
    console.error("[api/leads/payment-link] failed", describeError(error));
    return jsonError(500, "Couldn't create the payment link. Please try again.");
  }
}
