import type { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { describeError } from "@/lib/api/describe-error";
import { buildPaymentInvoiceDocument, parseInvoiceOverride } from "@/lib/invoices/invoice-document";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const money = z.number().min(0, "Can't be negative").max(10_000_000, "Too large");
const editSchema = z.union([
  z.object({ reset: z.literal(true) }),
  z.object({
    lines: z
      .array(
        z.object({
          description: z.string().trim().min(1, "Enter a description").max(160),
          quantity: z.number().int().min(1).max(99),
          governmentFee: money,
          serviceFee: money,
        })
      )
      .min(1, "Keep at least one line")
      .max(20),
    gstAmount: money,
  }),
]);

/**
 * Client doc 2026-10-15 (G6) — "Admin can edit invoice later like cost and service fee and GST".
 * GET: the invoice's current lines and GST (edited or computed). PATCH: save an edit (lines with the
 * Govt./Vendor/Airline fee and service fee, and the GST amount), or `{ reset: true }` to go back to the
 * computed invoice. finance.manage only, with a reason; audited. The payment itself never changes —
 * only what its invoice shows.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("finance.manage");
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    const payment = await db.payment.findUnique({ where: { id }, select: { status: true, invoiceOverride: true } });
    if (!payment) return jsonError(404, "Payment not found.");
    if (payment.status !== "SUCCESS") return jsonError(409, "Only a successful payment has an invoice.");
    const invoice = await buildPaymentInvoiceDocument(id);
    if (!invoice) return jsonError(409, "Only a successful payment has an invoice.");
    return jsonSuccess({
      invoiceNumber: invoice.invoiceNumber,
      feeLabel: invoice.feeLabel,
      edited: parseInvoiceOverride(payment.invoiceOverride) !== null,
      lines: invoice.lines.map((line) => ({ description: line.description, quantity: line.quantity, governmentFee: line.governmentFee, serviceFee: line.serviceFee })),
      gstAmount: invoice.gstAmount,
      couponDiscount: invoice.couponDiscount,
      gatewayFee: invoice.gatewayFee,
      grandTotal: invoice.grandTotal,
    });
  } catch (error) {
    console.error("[api/payments/invoice-edit] GET", describeError(error));
    return jsonError(500, "Couldn't load the invoice.");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("finance.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the invoice lines.", parsed.error.flatten().fieldErrors);
  const reasonResult = readBodyReason(body);
  if (reasonResult.error) return reasonResult.error;
  const { reason } = reasonResult;

  try {
    const payment = await db.payment.findUnique({ where: { id }, select: { id: true, status: true, booking: { select: { bookingId: true } } } });
    if (!payment) return jsonError(404, "Payment not found.");
    if (payment.status !== "SUCCESS") return jsonError(409, "Only a successful payment has an invoice.");

    const edit = "reset" in parsed.data ? null : parsed.data;
    const override = edit
      ? ({ lines: edit.lines, gstAmount: edit.gstAmount, note: reason ?? "", editedBy: session.name, editedAt: new Date().toISOString() } as Prisma.InputJsonValue)
      : Prisma.DbNull;
    const summary = edit
      ? `edited: ${edit.lines.map((line) => `${line.description} fee ₹${line.governmentFee} + service ₹${line.serviceFee}`).join("; ")}; GST ₹${edit.gstAmount}`
      : "reset to the computed figures";

    await db.$transaction(async (tx) => {
      await tx.payment.update({ where: { id }, data: { invoiceOverride: override } });
      await writeAudit(tx, {
        entityType: "Payment",
        entityId: id,
        action: edit ? "INVOICE_EDITED" : "INVOICE_EDIT_RESET",
        byUserId: session.id,
        note: withReason(`Invoice for booking ${payment.booking.bookingId} ${summary} (by ${session.name})`, reason),
      });
    });
    return jsonSuccess({ ok: true });
  } catch (error) {
    console.error("[api/payments/invoice-edit] PATCH", describeError(error));
    return jsonError(500, "Couldn't save the invoice.");
  }
}
