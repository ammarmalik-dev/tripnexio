import type { NextRequest } from "next/server";
import { manualLeadSchema, isFixedRateService } from "@/lib/validation/manual-lead-schema";
import { createLeadFromSubmission, type LeadPassengerInput } from "@/lib/leads/create-lead";
import { createAutoCheckout } from "@/lib/checkout/create-auto-checkout";
import { computeNewVisaPrice } from "@/lib/new-visa/pricing";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import type { PaxType } from "@/generated/prisma/enums";

/** ADULT first, then CHILD, then INFANT — a reasonable, disclosed default order for passenger-list display; doesn't affect pricing. */
function buildPlaceholderPassengers(fullName: string, adultCount: number, childCount: number, infantCount: number): LeadPassengerInput[] {
  const passengers: LeadPassengerInput[] = [{ fullName, paxType: "ADULT" }];
  for (let i = 2; i <= adultCount; i++) passengers.push({ fullName: `${fullName} - Adult ${i}`, paxType: "ADULT" });
  for (let i = 1; i <= childCount; i++) passengers.push({ fullName: `${fullName} - Child ${i}`, paxType: "CHILD" });
  for (let i = 1; i <= infantCount; i++) passengers.push({ fullName: `${fullName} - Infant ${i}`, paxType: "INFANT" });
  return passengers;
}

interface ResolvedPricing {
  totalPrice: number;
  vendorCost?: number;
  extraDetails: Record<string, unknown>;
}

/**
 * Resolves each fixed-rate service's own configured rate, exactly the way
 * that service's own public intake route already does — never fabricated.
 * Returns `null` (not a thrown error) for "valid service, just no
 * configured rate for this exact combo, or an invalid selection" — per
 * this step's own explicit "never lose the Lead" instruction, every one
 * of these outcomes here means "create the Lead anyway, route to
 * Quotations," not a hard rejection (unlike the equivalent public routes,
 * which reject an invalid selection outright since their dropdowns only
 * ever offer valid options to begin with — staff-entered data has no such
 * guarantee).
 */
async function resolveFixedRatePricing(
  data: import("@/lib/validation/manual-lead-schema").ManualLeadValues,
  travellerPaxTypes: PaxType[]
): Promise<{ pricing: ResolvedPricing | null; note?: string }> {
  if (data.serviceType === "NEW_VISA") {
    const price = await computeNewVisaPrice({
      countryCode: data.destinationCountryCode!,
      processingType: data.processingType as "normal" | "urgent",
      travellerPaxTypes,
    });
    if (!price) return { pricing: null, note: `No configured rate for ${data.destinationCountryCode}/${data.processingType}.` };
    return { pricing: { totalPrice: price.total, vendorCost: price.vendorCost, extraDetails: { destinationCountry: data.destinationCountryCode } } };
  }

  if (data.serviceType === "OTB") {
    const airline = await db.airline.findFirst({ where: { code: data.airlineCode!, active: true, otbRequired: true } });
    if (!airline) return { pricing: null, note: "That airline isn't available for OTB." };
    const unitPrice = Number(data.processingType === "urgent" ? airline.urgentPrice : airline.normalPrice);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return { pricing: null, note: `${airline.name} has no configured ${data.processingType} rate.` };
    }
    return { pricing: { totalPrice: unitPrice * travellerPaxTypes.length, extraDetails: { airline: data.airlineCode } } };
  }

  // RETURN_TICKET
  const destination = await db.returnTicketDestination.findFirst({
    where: { countryId: data.returnTicketDestinationCountryId!, active: true, country: { active: true } },
    include: { country: { select: { name: true } } },
  });
  if (!destination) return { pricing: null, note: "That destination isn't available." };
  const ratePerApplicant = Number(destination.ratePerApplicant);
  return {
    pricing: {
      totalPrice: ratePerApplicant * travellerPaxTypes.length,
      extraDetails: {
        destinationCountry: destination.country.name,
        destinationCountryId: data.returnTicketDestinationCountryId,
        // Client update (2026-09-24): the customer's/staff-entered target date — the actual issued ticket date is a separate, staff/availability-determined outcome.
        expectedReturnDate: data.returnTicketExpectedReturnDate,
      },
    },
  };
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

  const passengers = buildPlaceholderPassengers(data.fullName, data.adultCount, data.childCount, data.infantCount);
  const travelerCount = data.adultCount + data.childCount + data.infantCount;

  let pricingNote: string | undefined;
  let extraDetails: Record<string, unknown> = {};
  let resolvedPricing: ResolvedPricing | null = null;
  if (isFixedRateService(data.serviceType)) {
    const resolved = await resolveFixedRatePricing(
      data,
      passengers.map((p) => p.paxType ?? "ADULT")
    );
    resolvedPricing = resolved.pricing;
    pricingNote = resolved.note;
    if (resolved.pricing) extraDetails = resolved.pricing.extraDetails;
  }

  const result = await createLeadFromSubmission({
    serviceType: data.serviceType,
    source: data.source,
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
      ...extraDetails,
    },
  });

  let bookingId: string | undefined;
  if (resolvedPricing) {
    try {
      const checkout = await createAutoCheckout({
        leadId: result.leadId,
        serviceType: data.serviceType as "NEW_VISA" | "OTB" | "RETURN_TICKET",
        totalPrice: resolvedPricing.totalPrice,
        vendorCost: resolvedPricing.vendorCost,
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
