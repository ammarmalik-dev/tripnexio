import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { selectQuotation } from "@/lib/quotations/select-quotation";
import { createBookingFromQuotation } from "@/lib/bookings/create-booking";
import { createPendingPayment } from "@/lib/payments/create-payment";
import { describeError } from "@/lib/api/describe-error";
import { clientIp } from "@/lib/auth/rate-limit";
import { recordTermsAcceptance } from "@/lib/terms/service-terms";
import { extensionQuoteBlockReason } from "@/lib/visa-extension/rules";
import { notifyQuotationAccepted } from "@/lib/staff-notifications/triggers";

interface RouteParams {
  params: Promise<{ token: string }>;
}

const approveSchema = z.object({
  quotationId: z.string().min(1, "Select a quote"),
  /** P09 — mandatory: the service Terms & Conditions must be accepted to approve. */
  acceptTerms: z.literal(true, { error: "Please agree to the Terms & Conditions." }),
});

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

  // P13 — same gate as quoting: an extension no longer verified quotable can't be approved.
  if (extensionQuoteBlockReason(lead.serviceType, lead.details)) {
    return jsonError(409, "This request needs our team to review it again. Please contact support.");
  }

  const quotation = await db.quotation.findUnique({ where: { id: parsed.data.quotationId } });
  // P22 — a draft is invisible to the customer: treat it exactly like a quote that isn't theirs.
  if (!quotation || quotation.leadId !== lead.id || quotation.isDraft) {
    return jsonError(400, "That quote isn't part of this request.", { quotationId: ["Invalid selection."] });
  }

  const existingBooking = await db.booking.findFirst({
    where: { leadId: lead.id, status: { not: "CANCELLED" } },
    select: { id: true, customerToken: true, termsAcceptedAt: true },
  });
  if (existingBooking) {
    await recordTermsAcceptance({ ...existingBooking, lead }, clientIp(request), "quote approval");
    return jsonSuccess({ payToken: existingBooking.customerToken });
  }

  const selectResult = await selectQuotation(quotation.id, { label: "by the customer" });
  if (!selectResult.ok) {
    return jsonError(selectResult.error === "Quotation not found." ? 404 : 409, selectResult.error);
  }
  // P22 — staff notifications feed (selectQuotation has committed; never throws).
  await notifyQuotationAccepted(lead.id, quotation.id);

  const bookingResult = await createBookingFromQuotation(quotation.id, { label: "by the customer" });
  if (!bookingResult.ok) {
    return jsonError(bookingResult.status, bookingResult.error);
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingResult.booking.id },
    include: { customer: true, lead: true },
  });
  if (!booking) return jsonError(500, "Something went wrong. Please try again.");
  await recordTermsAcceptance(booking, clientIp(request), "quote approval");

  try {
    await createPendingPayment({ booking, quotation: selectResult.quotation, actor: { label: "customer approval (website)" } });
  } catch (error) {
    console.error("[api/quote/approve] payment creation failed", describeError(error));
    // The Booking still exists — staff can send a payment link from the CRM. Tell the customer to check back.
    return jsonError(500, "Your quote was approved, but we couldn't set up payment automatically. Our team will send you a payment link shortly.");
  }

  return jsonSuccess({ payToken: booking.customerToken });
}
