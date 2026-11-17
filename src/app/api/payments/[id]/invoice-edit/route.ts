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
    /** Client doc 16 Nov (I7) — the vendor and its cost: they update the booking's selected quotation, so the P&L follows. */
    vendorId: z.string().trim().min(1).optional(),
    vendorCost: money.optional(),
    /** Client doc 16 Nov (I9) — what was really collected and the provider's real gateway fee (shown on the invoice record). */
    actualCollected: money.optional(),
    actualGatewayFee: money.optional(),
  }),
]);

/**
 * Client doc 2026-10-15 (G6) — "Admin can edit invoice later like cost and service fee and GST".
 * GET: the invoice's current lines and GST (edited or computed). PATCH: save an edit (lines with the
 * Govt./Vendor/Airline fee and service fee, and the GST amount), or `{ reset: true }` to go back to the
 * computed invoice. finance.manage only, with a reason; audited. The payment itself never changes —
 * only what its invoice shows.
 */
/** The editable vendor fields (the booking's selected quotation) and the actual amounts saved on the invoice edit. */
async function vendorAndActuals(leadId: string, rawOverride: unknown) {
  const [quotation, vendors] = await Promise.all([
    db.quotation.findFirst({ where: { leadId, isSelected: true }, select: { vendorId: true, vendorCost: true } }),
    db.vendor.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const raw = (rawOverride && typeof rawOverride === "object" ? rawOverride : {}) as Record<string, unknown>;
  return {
    vendorId: quotation?.vendorId ?? null,
    vendorCost: quotation ? Number(quotation.vendorCost) : null,
    vendors,
    actualCollected: typeof raw.actualCollected === "number" ? raw.actualCollected : null,
    actualGatewayFee: typeof raw.actualGatewayFee === "number" ? raw.actualGatewayFee : null,
  };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("invoices.edit");
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    const payment = await db.payment.findUnique({ where: { id }, select: { status: true, invoiceOverride: true, booking: { select: { leadId: true } } } });
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
      // Client doc 16 Nov (I7 / I9) — the booking's vendor + cost (selected quotation) and the recorded actual amounts.
      ...(await vendorAndActuals(payment.booking.leadId, payment.invoiceOverride)),
    });
  } catch (error) {
    console.error("[api/payments/invoice-edit] GET", describeError(error));
    return jsonError(500, "Couldn't load the invoice.");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // Client doc 16 Nov (I7) — its own "Invoice Edit" permission (admin.full includes it).
  const auth = await requirePermission("invoices.edit");
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
    const payment = await db.payment.findUnique({
      where: { id },
      select: { id: true, status: true, invoiceOverride: true, booking: { select: { id: true, bookingId: true, leadId: true } } },
    });
    if (!payment) return jsonError(404, "Payment not found.");
    if (payment.status !== "SUCCESS") return jsonError(409, "Only a successful payment has an invoice.");

    const edit = "reset" in parsed.data ? null : parsed.data;
    const override = edit
      ? ({
          lines: edit.lines,
          gstAmount: edit.gstAmount,
          ...(edit.actualCollected != null ? { actualCollected: edit.actualCollected } : {}),
          ...(edit.actualGatewayFee != null ? { actualGatewayFee: edit.actualGatewayFee } : {}),
          note: reason ?? "",
          editedBy: session.name,
          editedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue)
      : Prisma.DbNull;
    const lineText = (lines: { description: string; governmentFee: number; serviceFee: number }[]) =>
      lines.map((line) => `${line.description} fee ₹${line.governmentFee} + service ₹${line.serviceFee}`).join("; ");
    // Client doc 16 Nov (I7) — the audit keeps the previous and the new values.
    const before = parseInvoiceOverride(payment.invoiceOverride);
    const summary = edit
      ? `edited: ${before ? `was [${lineText(before.lines)}; GST ₹${before.gstAmount}] ` : ""}now [${lineText(edit.lines)}; GST ₹${edit.gstAmount}]` +
        (edit.actualCollected != null ? `; actual collected ₹${edit.actualCollected}` : "") +
        (edit.actualGatewayFee != null ? `; actual gateway fee ₹${edit.actualGatewayFee}` : "")
      : "reset to the computed figures";

    // The vendor + cost live on the booking's selected quotation (the P&L reads it from there).
    const quotation =
      edit && (edit.vendorId || edit.vendorCost != null)
        ? await db.quotation.findFirst({
            where: { leadId: payment.booking.leadId, isSelected: true },
            select: { id: true, vendorId: true, vendorCost: true, sellingPrice: true, vendor: { select: { name: true } } },
          })
        : null;
    if (edit && (edit.vendorId || edit.vendorCost != null) && !quotation) return jsonError(409, "This booking has no selected quotation to record the vendor on.");
    const vendor = edit?.vendorId ? await db.vendor.findFirst({ where: { id: edit.vendorId, active: true }, select: { id: true, name: true } }) : null;
    if (edit?.vendorId && !vendor) return jsonError(400, "Pick an active vendor.", { vendorId: ["Pick an active vendor."] });

    await db.$transaction(async (tx) => {
      await tx.payment.update({ where: { id }, data: { invoiceOverride: override } });
      if (quotation && edit) {
        const cost = edit.vendorCost ?? Number(quotation.vendorCost);
        await tx.quotation.update({
          where: { id: quotation.id },
          data: { ...(vendor ? { vendorId: vendor.id } : {}), vendorCost: cost, margin: Number(quotation.sellingPrice) - cost },
        });
        await writeAudit(tx, {
          entityType: "Booking",
          entityId: payment.booking.id,
          action: "VENDOR_COST_EDITED",
          byUserId: session.id,
          note: withReason(
            `From the invoice edit: vendor ${quotation.vendor.name} -> ${vendor?.name ?? quotation.vendor.name}, vendor cost ₹${Number(quotation.vendorCost)} -> ₹${cost} (P&L follows) (by ${session.name})`,
            reason
          ),
        });
      }
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
