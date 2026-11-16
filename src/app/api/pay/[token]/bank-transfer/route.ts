import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { loadCheckoutByToken } from "@/lib/checkout/load-checkout";
import { saveUploadedFile } from "@/lib/storage/local-file-storage";
import { rejectInvalidDocumentUploads } from "@/lib/uploads/validate-upload";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { gatewayForPayment } from "@/lib/payments/accounts";
import { createPendingBankTransferPayment } from "@/lib/payments/create-bank-transfer-payment";
import { syncExpiredQuotations } from "@/lib/quotations/sync-expiry";
import { notifyStaff } from "@/lib/staff-notifications/notify";
import { OFFLINE_PAYMENT_SERVICES } from "@/lib/payments/offline-payment";
import { describeError } from "@/lib/api/describe-error";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/** Keeps the JSON body under typical serverless request limits (~4.5MB). */
const MAX_BASE64_LENGTH = 4_000_000;

const schema = z.object({
  fileBase64: z.string().min(1, "Choose the receipt").max(MAX_BASE64_LENGTH, "That file is too large (3MB max)"),
  mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
});

/**
 * Client doc 16 Nov (I2) — "Offline Payment Option After Quotation Acceptance": for Visa Change / Visa Extension /
 * Special Fare the customer may pay the accepted quotation by bank transfer and upload the receipt here. The online link
 * (if any) is cancelled at the gateway, the payment becomes a bank transfer carrying the receipt, and it stays
 * "Payment Verification Pending" until an authorised approver confirms it (Payments → Approve bank transfer) — only
 * then is the payment received and the booking active. Uploading again replaces the receipt while it awaits approval.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const limited = await rateLimitByIp(request, "pay-bank-transfer", { limit: 10, windowMs: 15 * 60 * 1000 }, "Too many uploads. Please try again in a few minutes.");
  if (limited) return limited;
  const { token } = await params;
  const checkout = await loadCheckoutByToken(token);
  if (!checkout) return jsonError(404, "We couldn't find that payment page.");
  const { booking, view } = checkout;
  if (!OFFLINE_PAYMENT_SERVICES.has(booking.lead.serviceType)) return jsonError(409, "Bank transfer isn't available for this service — please use the online payment.");
  if (view.payment?.status !== "PENDING") return jsonError(409, "This booking has no payment waiting.");
  if (view.quotationExpired) return jsonError(409, view.notPayableReason ?? "This quotation can't be paid any more.");
  if (!view.termsAccepted) return jsonError(409, "Please accept the terms first.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the file and try again.", parsed.error.flatten().fieldErrors);
  const uploadError = rejectInvalidDocumentUploads([parsed.data.fileBase64]);
  if (uploadError) return uploadError;

  try {
    let payment = await db.payment.findFirst({ where: { bookingId: booking.id, status: "PENDING" }, orderBy: { createdAt: "desc" } });
    if (!payment) return jsonError(409, "This booking has no payment waiting.");

    if (payment.method === "GATEWAY") {
      // The online link is cancelled at the gateway first, so the customer can't pay twice.
      if (payment.gatewayRef) {
        try {
          const gateway = await gatewayForPayment(payment);
          await gateway.cancelPaymentLink(payment.gatewayRef);
        } catch {
          return jsonError(409, "We couldn't switch this payment to bank transfer right now — if you've already paid online, please refresh the page.");
        }
      }
      const previousId = payment.id;
      await db.$transaction(async (tx) => {
        await tx.payment.update({ where: { id: previousId }, data: { status: "EXPIRED" } });
        await writeAudit(tx, {
          entityType: "Payment",
          entityId: previousId,
          action: "PAYMENT_METHOD_SWITCHED",
          note: "Online link cancelled — the customer chose bank transfer on the payment page",
        });
      });
      const full = await db.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { customer: true, lead: { include: { quotations: { where: { isSelected: true } } } } } });
      const [quotation] = await syncExpiredQuotations(full.lead.quotations);
      if (!quotation) return jsonError(409, "This quotation can't be paid any more.");
      const created = await createPendingBankTransferPayment({ booking: full, quotation, actor: { label: "customer (payment page)" } });
      payment = await db.payment.findUniqueOrThrow({ where: { id: created.id } });
    }

    const { url } = await saveUploadedFile(parsed.data.fileBase64);
    const paymentId = payment.id;
    await db.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: paymentId }, data: { bankSlipUrl: url } });
      await writeAudit(tx, {
        entityType: "Payment",
        entityId: paymentId,
        action: "BANK_SLIP_UPLOADED",
        note: "Bank-transfer receipt uploaded by the customer (payment page) — awaiting verification",
      });
    });
    await notifyStaff({
      type: "PAYMENT_RECEIVED",
      title: `Bank transfer receipt to verify — ${booking.bookingId}`,
      body: "The customer uploaded a bank-transfer receipt. Verify the money arrived, then approve the payment.",
      link: `/crm/bookings/${booking.id}`,
      entityType: "Payment",
      entityId: paymentId,
      recipients: { permission: "payments.approve" },
    });
    return jsonSuccess({ status: "VERIFICATION_PENDING" }, 201);
  } catch (error) {
    console.error("[api/pay/bank-transfer]", describeError(error));
    return jsonError(500, "Couldn't upload the receipt. Please try again.");
  }
}
