import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertServiceAction } from "@/lib/auth/service-actions";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";
import { bookingActionBlock } from "@/lib/bookings/action-block";
import { isInternallyCreatedLead } from "@/lib/leads/internal-lead";
import { syncExpiredQuotations } from "@/lib/quotations/sync-expiry";
import { createPendingPayment } from "@/lib/payments/create-payment";
import { createPendingBankTransferPayment } from "@/lib/payments/create-bank-transfer-payment";
import { gatewayForPayment } from "@/lib/payments/accounts";
import { PaymentGatewayConfigError } from "@/lib/payments/get-gateway";
import { sensitiveReasonSchema, withReason } from "@/lib/validation/sensitive-action";
import { describeError } from "@/lib/api/describe-error";
import { OFFLINE_PAYMENT_SERVICES } from "@/lib/payments/offline-payment";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const schema = z.object({ to: z.enum(["GATEWAY", "BANK_TRANSFER"]), reason: sensitiveReasonSchema });


/**
 * Client doc 16 Nov (I1) — "Allow staff to switch payment methods before payment is completed." The booking's unpaid
 * payment is replaced by one of the other method: an online link is first cancelled AT THE GATEWAY (so the customer
 * can't pay it as well as transfer the money), then the old payment is closed (EXPIRED) and the new one created. Bank
 * transfer is for staff-created leads and the quotation services. Audited with the reason.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("payments.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id: bookingId } = await params;
  const ownershipError = await assertOwnsEntity(session, "booking", bookingId);
  if (ownershipError) return ownershipError;
  const actionBlock = await bookingActionBlock(bookingId);
  if (actionBlock) return jsonError(409, actionBlock);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const { to, reason } = parsed.data;

  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, lead: { include: { quotations: { where: { isSelected: true } } } } },
    });
    if (!booking) return jsonError(404, "Booking not found.");
    const scopeError = assertServiceAccess(session, booking.lead.serviceType);
    if (scopeError) return scopeError;
    const serviceError = assertServiceAction(session, booking.lead.serviceType, "PAYMENT");
    if (serviceError) return serviceError;
    if (booking.status !== "PENDING") return jsonError(409, "This booking is already paid — the payment method can't change now.");

    const pending = await db.payment.findFirst({ where: { bookingId, status: "PENDING" }, orderBy: { createdAt: "desc" } });
    if (!pending) return jsonError(409, "There's no unpaid payment to switch.");
    if (pending.method === to) return jsonError(409, `This payment is already ${to === "GATEWAY" ? "an online link" : "a bank transfer"}.`);
    if (to === "BANK_TRANSFER" && !OFFLINE_PAYMENT_SERVICES.has(booking.lead.serviceType) && !(await isInternallyCreatedLead(booking.lead))) {
      return jsonError(409, "Bank transfer is for leads created by staff and for quotation services. Send the customer the online payment link instead.");
    }
    const [quotation] = await syncExpiredQuotations(booking.lead.quotations);
    if (!quotation) return jsonError(409, "No selected quotation found for this booking's lead.");

    // An online link is cancelled at the gateway first — if that fails (e.g. the customer has just paid it) nothing changes.
    if (pending.method === "GATEWAY" && pending.gatewayRef) {
      try {
        const gateway = await gatewayForPayment(pending);
        await gateway.cancelPaymentLink(pending.gatewayRef);
      } catch (error) {
        const message = error instanceof Error ? error.message : "The gateway couldn't cancel the link.";
        return jsonError(502, `${message} Nothing was changed — use Check status in case the customer has already paid.`);
      }
    }

    await db.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: pending.id }, data: { status: "EXPIRED" } });
      await writeAudit(tx, {
        entityType: "Payment",
        entityId: pending.id,
        action: "PAYMENT_METHOD_SWITCHED",
        byUserId: session.id,
        note: withReason(`${pending.method === "GATEWAY" ? "Online link cancelled" : "Bank transfer withdrawn"} — switched to ${to === "GATEWAY" ? "an online payment link" : "bank transfer"} (by ${session.name})`, reason),
      });
    });

    const actor = { byUserId: session.id, label: `by ${session.name}` };
    const payment =
      to === "GATEWAY"
        ? await createPendingPayment({ booking, quotation, actor })
        : await createPendingBankTransferPayment({ booking, quotation, actor });
    return jsonSuccess(payment, 201);
  } catch (error) {
    if (error instanceof PaymentGatewayConfigError) return jsonError(503, error.message);
    console.error("[api/bookings/payment-method]", describeError(error));
    return jsonError(500, "Couldn't switch the payment method. Please try again.");
  }
}
