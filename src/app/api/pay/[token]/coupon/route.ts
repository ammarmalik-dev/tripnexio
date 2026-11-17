import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { loadCheckoutByToken } from "@/lib/checkout/load-checkout";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { resolveCouponForQuotation } from "@/lib/coupons/apply";
import { gatewayForPayment } from "@/lib/payments/accounts";
import { createPendingPayment } from "@/lib/payments/create-payment";
import { PaymentGatewayConfigError } from "@/lib/payments/get-gateway";
import { describeError } from "@/lib/api/describe-error";

interface RouteParams {
  params: Promise<{ token: string }>;
}

const schema = z.object({ code: z.string().trim().min(3, "Enter the coupon code").max(40) });

/** Client doc 16 Nov (I11) — the services whose customers may apply a coupon at checkout. */
const COUPON_CHECKOUT_SERVICES = new Set(["NEW_VISA", "OTB", "RETURN_TICKET"]);

/**
 * Client doc 16 Nov (I11, "Website / External Customer Checkout") — the customer enters a coupon on the payment page
 * before paying (New Visa / OTB / Return Ticket). The same coupon rules as staff use (active, dates, services, limits,
 * lead-scoped codes) apply; the unpaid online link is cancelled at the gateway and a new one for the discounted total
 * is created, so the customer sees and pays the updated amount. One coupon per booking.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const limited = await rateLimitByIp(request, "pay-coupon", { limit: 15, windowMs: 15 * 60 * 1000 }, "Too many attempts. Please try again in a few minutes.");
  if (limited) return limited;
  const { token } = await params;
  const checkout = await loadCheckoutByToken(token);
  if (!checkout) return jsonError(404, "We couldn't find that payment page.");
  const { view } = checkout;
  if (!COUPON_CHECKOUT_SERVICES.has(checkout.booking.lead.serviceType)) return jsonError(409, "Coupons can't be used for this service.");
  if (view.payment?.status !== "PENDING") return jsonError(409, "This booking has no payment waiting.");
  if (view.quotationExpired) return jsonError(409, view.notPayableReason ?? "This booking can't be paid any more.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the coupon code.", parsed.error.flatten().fieldErrors);

  try {
    const booking = await db.booking.findUniqueOrThrow({
      where: { id: checkout.booking.id },
      include: { customer: true, lead: { include: { quotations: { where: { isSelected: true } } } } },
    });
    const quotation = booking.lead.quotations[0];
    if (!quotation) return jsonError(409, "This booking can't take a coupon.");
    if (quotation.couponId) return jsonError(409, quotation.couponCode ? `Coupon ${quotation.couponCode} is already applied.` : "A coupon is already applied.");
    const pending = await db.payment.findFirst({ where: { bookingId: booking.id, status: "PENDING" }, orderBy: { createdAt: "desc" } });
    if (!pending || pending.method !== "GATEWAY") return jsonError(409, "A coupon can be applied only to an online payment.");

    const result = await resolveCouponForQuotation(parsed.data.code, booking.lead.serviceType, Number(quotation.sellingPrice), booking.leadId);
    if (!result.ok) return jsonError(400, result.error, { code: [result.error] });

    if (pending.gatewayRef) {
      try {
        const gateway = await gatewayForPayment(pending);
        await gateway.cancelPaymentLink(pending.gatewayRef);
      } catch {
        return jsonError(409, "We couldn't apply the coupon right now — if you've already paid, please refresh the page.");
      }
    }
    const updatedQuotation = await db.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: pending.id }, data: { status: "EXPIRED" } });
      const saved = await tx.quotation.update({
        where: { id: quotation.id },
        data: { couponId: result.coupon.couponId, couponCode: result.coupon.couponCode, couponDiscount: result.coupon.discountAmount },
      });
      await writeAudit(tx, {
        entityType: "Booking",
        entityId: booking.id,
        action: "COUPON_APPLIED",
        note: `Coupon ${result.coupon.couponCode} applied by the customer on the payment page (−₹${result.coupon.discountAmount}); the payment link was renewed for the new total`,
      });
      return saved;
    });
    await createPendingPayment({ booking, quotation: updatedQuotation, actor: { label: "customer coupon (payment page)" }, skipWhatsAppNotice: true });
    return jsonSuccess({ couponCode: result.coupon.couponCode, discount: result.coupon.discountAmount });
  } catch (error) {
    if (error instanceof PaymentGatewayConfigError) return jsonError(503, "Online payment is unavailable right now. Please try again later.");
    console.error("[api/pay/coupon]", describeError(error));
    return jsonError(500, "Couldn't apply the coupon. Please try again.");
  }
}
