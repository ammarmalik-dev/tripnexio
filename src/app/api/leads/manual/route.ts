import { db } from "@/lib/db";
import { manualOtbTripError } from "@/lib/otb/manual-trip-check";
import { createLeadDocumentSlots } from "@/lib/documents/lead-document-slots";
import type { NextRequest } from "next/server";
import { manualLeadSchema, isFixedRateService } from "@/lib/validation/manual-lead-schema";
import { createLeadFromSubmission, type LeadPassengerInput } from "@/lib/leads/create-lead";
import { createAutoCheckout } from "@/lib/checkout/create-auto-checkout";
import { manualLeadServiceDetails, previewManualLeadPrice } from "@/lib/leads/manual-lead-pricing";
import type { DirectPaymentPrice } from "@/lib/checkout/lead-direct-payment";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertServiceAction } from "@/lib/auth/service-actions";

/** ADULT first, then CHILD, then INFANT — a reasonable, disclosed default order for passenger-list display; doesn't affect pricing. */
function buildPlaceholderPassengers(fullName: string, adultCount: number, childCount: number, infantCount: number): LeadPassengerInput[] {
  const passengers: LeadPassengerInput[] = [{ fullName, paxType: "ADULT" }];
  for (let i = 2; i <= adultCount; i++) passengers.push({ fullName: `${fullName} - Adult ${i}`, paxType: "ADULT" });
  for (let i = 1; i <= childCount; i++) passengers.push({ fullName: `${fullName} - Child ${i}`, paxType: "CHILD" });
  for (let i = 1; i <= infantCount; i++) passengers.push({ fullName: `${fullName} - Infant ${i}`, paxType: "INFANT" });
  return passengers;
}

/**
 * Step 51 (Internal Dashboard Merged §8) — the Manual Lead / Offline
 * Payment Collection form's creation endpoint. Staff-only (unlike the 6
 * public per-service `/api/leads/*` routes) — always creates the Lead
 * first regardless of pricing outcome ("if payment is not completed after
 * the basic form, capture the details as a Lead for follow-up," which
 * this always satisfies since a Lead exists the moment this returns 201).
 *
 * For the 3 fixed-rate services (New Visa/OTB/Return Ticket) with a
 * configured rate, also creates the auto-priced Quotation + PENDING
 * Booking (via createAutoCheckout, payment deferred — see its own
 * `skipAutoPayment` doc comment) so staff can immediately pick Payment
 * Link or Bank Transfer on the Booking detail page. For every other
 * service (or an unconfigured fixed-rate combo, or "Other"), only the
 * Lead is created — staff builds a quotation manually via the existing
 * QuoteBuilder on the Lead detail page, exactly the "if a service
 * requires a quotation, route the record to Quotations" rule; no new
 * quotation UI was needed for this since that flow already exists.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermission("leads.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = manualLeadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  const scopeError = assertServiceAccess(session, data.serviceType);
  if (scopeError) return scopeError;
  const actionError = assertServiceAction(session, data.serviceType, "CREATE_LEAD");
  if (actionError) return actionError;

  // OTB and Return Ticket have one rate for every passenger (client reply 2026-10-13): the form asks one count, kept in adultCount.
  if (data.serviceType === "OTB" || data.serviceType === "RETURN_TICKET") {
    data.childCount = 0;
    data.infantCount = 0;
  }
  const passengers = buildPlaceholderPassengers(data.fullName, data.adultCount, data.childCount, data.infantCount);
  // Client doc 16 Nov (D5) — Visa Change: every passenger carries the nationality (it decides their document checklist).
  if (data.serviceType === "VISA_CHANGE" && data.nationalityId) {
    const nationality = await db.nationality.findFirst({ where: { id: data.nationalityId, active: true }, select: { id: true, name: true } });
    if (!nationality) return jsonError(400, "Select a valid nationality.", { nationalityId: ["Select a valid nationality."] });
    passengers.forEach((passenger) => {
      passenger.nationalityId = nationality.id;
      passenger.nationality = nationality.name;
    });
  }
  // Client doc 16 Nov (E6) — Visa Extension: each passenger's passport number, for staff verification.
  if (data.serviceType === "VISA_EXTENSION") {
    passengers.forEach((passenger, index) => {
      const passport = data.passportNumbers?.[index]?.replace(/[\s-]/g, "").toUpperCase();
      if (passport) passenger.passportNumber = passport;
    });
  }
  const travelerCount = data.adultCount + data.childCount + data.infantCount;

  // Client doc 16 Nov (C3) — OTB: active country, live airline, and the airline's TAT on the working calendar.
  if (data.serviceType === "OTB") {
    const tripError = await manualOtbTripError(data);
    if (tripError) return jsonError(400, tripError.message, { [tripError.field]: [tripError.message] });
  }

  // Client doc 2026-10-20 (K1) — the same configured price as the website / direct payment link (New Visa option +
  // nationality, OTB airline + destination, Return Ticket destination), with the service's own details.
  const serviceDetails = await manualLeadServiceDetails(data);
  let pricingNote: string | undefined;
  let resolvedPrice: Extract<DirectPaymentPrice, { ok: true }> | null = null;
  if (isFixedRateService(data.serviceType)) {
    const { price } = await previewManualLeadPrice(data, serviceDetails);
    // Client doc 16 Nov (I12) — New Visa / OTB / Return Ticket manual leads only when their price is configured.
    if (!price.ok) return jsonError(409, `${price.error} Configure the price in Admin first — a manual lead for this service needs it.`);
    resolvedPrice = price;
  }

  const result = await createLeadFromSubmission({
    serviceType: data.serviceType,
    source: data.source,
    createdBy: { id: session.id, name: session.name },
    contact: { fullName: data.fullName, mobile: data.mobile, email: data.email ?? "" },
    passengers,
    details: {
      travelDate: data.travelDate || undefined,
      travelers: String(travelerCount),
      adultCount: data.adultCount,
      childCount: data.childCount,
      infantCount: data.infantCount,
      manualEntry: true,
      manualEntryBy: session.name,
      ...(data.serviceType === "OTHER" ? { otherServiceDescription: data.otherServiceDescription } : {}),
      ...serviceDetails,
    },
  });

  // Client doc 16 Nov (E6) — Visa Extension: the configured documents appear on the lead for every passenger, for
  // staff to upload (or the customer, once asked).
  // Client doc 16 Nov (C3) — OTB too: the destination's configured documents, for staff to upload or ask for.
  if (data.serviceType === "VISA_EXTENSION" || data.serviceType === "VISA_CHANGE" || data.serviceType === "OTB") {
    try {
      await createLeadDocumentSlots(result.leadId, data.serviceType);
    } catch (error) {
      console.error("[api/leads/manual] document slots", error instanceof Error ? error.message : "failed");
    }
  }

  let bookingId: string | undefined;
  if (resolvedPrice) {
    try {
      const checkout = await createAutoCheckout({
        leadId: result.leadId,
        serviceType: resolvedPrice.serviceType,
        totalPrice: resolvedPrice.totalPrice,
        vendorCost: resolvedPrice.vendorCost,
        invoiceLines: resolvedPrice.invoiceLines,
        extraCharges: data.extraCharges,
        couponCode: data.couponCode,
        skipAutoPayment: true,
      });
      bookingId = checkout?.bookingId;
    } catch (checkoutError) {
      // A bad coupon code throws — surface it, but never lose the already-created Lead.
      pricingNote = checkoutError instanceof Error ? checkoutError.message : "Couldn't apply the coupon.";
    }
  }

  return jsonSuccess({ ...result, bookingId, requiresQuotation: !bookingId, pricingNote }, 201);
}
