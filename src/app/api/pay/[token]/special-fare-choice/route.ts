import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { dispatchStatusNotifications } from "@/lib/service-status/engine";
import { createExtraPayment } from "@/lib/payments/create-payment";
import { recordCustomerDecision } from "@/lib/special-fare/post-payment";
import { describeError } from "@/lib/api/describe-error";

interface RouteParams {
  params: Promise<{ token: string }>;
}

const choiceSchema = z.object({ choice: z.enum(["PAY", "REFUND"]) });

/**
 * P16 — Flight_Special_Fare.md §18: the paid flight became unavailable and
 * the only alternative costs more. The customer decides on their booking's
 * payment page: "Pay Additional Amount" (an extra payment on the same
 * booking, shown on this same page) or "Request Refund" (full refund raised).
 * Never forced into the higher fare.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const limited = await rateLimitByIp(request, "special-fare-choice", { limit: 20, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) return jsonError(404, "Page not found.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = choiceSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Choose to pay the difference or request a refund.");

  const booking = await db.booking.findUnique({ where: { customerToken: token }, include: { customer: true, lead: true } });
  if (!booking || booking.lead.serviceType !== "FLIGHT_SPECIAL_FARE") return jsonError(404, "Page not found.");

  try {
    const result = await recordCustomerDecision(booking.id, parsed.data.choice);
    if (!result.ok) return jsonError(result.httpStatus, result.error);
    await dispatchStatusNotifications(result.notifications);
    if (result.payDifference) {
      try {
        await createExtraPayment({
          booking,
          amount: result.payDifference,
          description: "Special Fare — fare difference for the alternative flight",
          actor: { label: "customer choice (website)" },
        });
      } catch (paymentError) {
        console.error("[api/pay/special-fare-choice] extra payment failed", describeError(paymentError));
        return jsonError(502, "Your choice was saved, but we couldn't set up the payment automatically. Our team will send you a payment link shortly.");
      }
    }
    return jsonSuccess({ message: result.message });
  } catch (error) {
    console.error("[api/pay/special-fare-choice]", describeError(error));
    return jsonError(500, "Couldn't save your choice. Please try again.");
  }
}
