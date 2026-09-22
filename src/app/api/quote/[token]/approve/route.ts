import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { selectQuotation } from "@/lib/quotations/select-quotation";
import { createBookingFromQuotation } from "@/lib/bookings/create-booking";
import { createPendingPayment } from "@/lib/payments/create-payment";

interface RouteParams {
  params: Promise<{ token: string }>;
}

const approveSchema = z.object({ quotationId: z.string().min(1, "Select a quote") });

/**
 * The customer approves one of their quote options: selects it (expiring the
 * others, same rule the staff CRM action enforces), creates the Booking, and
 * creates the payment link — then hands the frontend a `payToken` so it can
 * continue on the existing /pay/<token> page. If a booking already exists for
 * this lead (e.g. staff created one from the CRM first), that booking's own
 * token is returned instead of creating a duplicate.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) return jsonError(404, "Page not found.");

  const lead = await db.lead.findUnique({ where: { customerToken: token } });
  if (!lead) return jsonError(404, "Page not found.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const quotation = await db.quotation.findUnique({ where: { id: parsed.data.quotationId } });
  if (!quotation || quotation.leadId !== lead.id) {
    return jsonError(400, "That quote isn't part of this request.", { quotationId: ["Invalid selection."] });
  }

  const existingBooking = await db.booking.findFirst({
    where: { leadId: lead.id, status: { not: "CANCELLED" } },
    select: { id: true, customerToken: true },
  });
  if (existingBooking) {
    return jsonSuccess({ payToken: existingBooking.customerToken });
  }

  const selectResult = await selectQuotation(quotation.id, { label: "by the customer" });
  if (!selectResult.ok) {
    return jsonError(selectResult.error === "Quotation not found." ? 404 : 409, selectResult.error);
  }

  const bookingResult = await createBookingFromQuotation(quotation.id, { label: "by the customer" });
  if (!bookingResult.ok) {
    return jsonError(bookingResult.status, bookingResult.error);
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingResult.booking.id },
    include: { customer: true, lead: true },
  });
  if (!booking) return jsonError(500, "Something went wrong. Please try again.");

  try {
    await createPendingPayment({ booking, quotation: selectResult.quotation, actor: { label: "customer approval (website)" } });
  } catch (error) {
    console.error("[api/quote/approve] payment creation failed", error);
    // The Booking still exists — staff can send a payment link from the CRM. Tell the customer to check back.
    return jsonError(500, "Your quote was approved, but we couldn't set up payment automatically. Our team will send you a payment link shortly.");
  }

  return jsonSuccess({ payToken: booking.customerToken });
}
