import type { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/auth/get-customer-session";
import { buildInvoicePdfForPayment } from "@/lib/invoices/render-invoice";

interface RouteParams {
  params: Promise<{ paymentId: string }>;
}

/** Client corrections 2026-10-05 — the signed-in customer downloads the invoice of their own successful payment. Anyone else gets 404. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getCustomerSession();
  if (!session) return jsonError(401, "Please log in.");
  const { paymentId } = await params;

  const payment = await db.payment.findFirst({
    where: { id: paymentId, status: "SUCCESS", booking: { customerId: session.id } },
    select: { id: true, booking: { select: { bookingId: true } } },
  });
  if (!payment) return jsonError(404, "Invoice not found.");

  try {
    const invoice = await buildInvoicePdfForPayment(payment.id);
    if (!invoice) return jsonError(404, "Invoice not found.");
    return new Response(new Uint8Array(invoice.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${payment.booking.bookingId.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[api/account/invoices] failed", error);
    return jsonError(500, "Couldn't prepare the invoice. Please try again.");
  }
}
