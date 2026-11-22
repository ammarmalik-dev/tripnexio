import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { dispatchStatusNotifications } from "@/lib/service-status/engine";
import { recordTicketFlowDecision } from "@/lib/special-fare/ticket-cancellation";
import { notifyRefundsRaised } from "@/lib/staff-notifications/triggers";
import { describeError } from "@/lib/api/describe-error";

interface RouteParams {
  params: Promise<{ token: string }>;
}

const choiceSchema = z.object({ choice: z.enum(["ACCEPT", "DECLINE", "REFUND"]) });

/**
 * Client doc 16 Nov (A12 / A14) — the customer, on their booking page: approve or decline the ticket cancellation
 * quotation, or accept the airline's new schedule / request a refund. Token-gated, rate-limited.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const limited = await rateLimitByIp(request, "ticket-flow-choice", { limit: 20, windowMs: 60 * 60 * 1000 });
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
  if (!parsed.success) return jsonError(400, "Please choose an option.");

  const booking = await db.booking.findUnique({ where: { customerToken: token }, select: { id: true, lead: { select: { serviceType: true } } } });
  if (!booking || booking.lead.serviceType !== "FLIGHT_SPECIAL_FARE") return jsonError(404, "Page not found.");

  try {
    const result = await recordTicketFlowDecision(booking.id, parsed.data.choice);
    if (!result.ok) return jsonError(result.httpStatus, result.error);
    await dispatchStatusNotifications(result.notifications);
    if (result.refundIds?.length) await notifyRefundsRaised(result.refundIds);
    return jsonSuccess({ message: result.message });
  } catch (error) {
    console.error("[api/pay/ticket-flow]", describeError(error));
    return jsonError(500, "Couldn't save your choice. Please try again.");
  }
}
