import type { NextRequest } from "next/server";
import { manualLeadSchema, isFixedRateService } from "@/lib/validation/manual-lead-schema";
import { createLeadFromSubmission, type LeadPassengerInput } from "@/lib/leads/create-lead";
import { createAutoCheckout } from "@/lib/checkout/create-auto-checkout";
import { manualLeadServiceDetails, previewManualLeadPrice } from "@/lib/leads/manual-lead-pricing";
import type { DirectPaymentPrice } from "@/lib/checkout/lead-direct-payment";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";

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

  // OTB and Return Ticket have one rate for every passenger (client reply 2026-10-13): the form asks one count, kept in adultCount.
  if (data.serviceType === "OTB" || data.serviceType === "RETURN_TICKET") {
    data.childCount = 0;
    data.infantCount = 0;
  }
  const passengers = buildPlaceholderPassengers(data.fullName, data.adultCount, data.childCount, data.infantCount);
  const travelerCount = data.adultCount + data.childCount + data.infantCount;

  // Client doc 2026-10-20 (K1) — the same configured price as the website / direct payment link (New Visa option +
  // nationality, OTB airline + destination, Return Ticket destination), with the service's own details.
  const serviceDetails = await manualLeadServiceDetails(data);
  let pricingNote: string | undefined;
  let resolvedPrice: Extract<DirectPaymentPrice, { ok: true }> | null = null;
  if (isFixedRateService(data.serviceType)) {
    const { price } = await previewManualLeadPrice(data, serviceDetails);
    if (price.ok) resolvedPrice = price;
    else pricingNote = price.error;
  }

  const result = await createLeadFromSubmission({
    serviceType: data.serviceType,
    source: data.source,
    createdBy: { id: session.id, name: session.name },
    contact: { fullName: data.fullName, mobile: data.mobile, email: data.email ?? "" },
    passengers,
    details: {
      travelDate: data.travelDate,
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
