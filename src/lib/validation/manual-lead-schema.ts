import { z } from "zod";

/** Client corrections 2026-10-05 — the Manual Lead "Source" options (required). */
export const MANUAL_LEAD_SOURCES = [
  "Facebook",
  "Instagram",
  "Website",
  "Meta Ads",
  "Google Ads",
  "Walk-in",
  "Callback",
  "Toll Free",
  "Email",
  "Offline",
  "Referral",
] as const;
import { ServiceType, type ServiceType as ServiceTypeT } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeT, ...ServiceTypeT[]];

/**
 * Step 51 (Internal Dashboard Merged §8) — the Manual Lead / Offline
 * Payment Collection form. Deliberately a *lighter* capture form than each
 * service's own website intake (no per-traveller passport/guardian
 * details) — the client's own field list is generic (Name/Mobile/Email/
 * Source/Service/Travel Date/traveller counts), matching a phone-intake
 * scenario, not the full multi-step website flow.
 *
 * The three conditional blocks below (New Visa/OTB/Return Ticket) are NOT
 * in the client's literal field list, but are the minimum needed to look
 * up each service's own Admin-configured rate — "calculate the amount
 * automatically using configured rates" is impossible without them (New
 * Visa needs a country, OTB an airline, Return Ticket a destination — the
 * exact same axes their own real intake forms already ask for). A
 * disclosed judgment call, not an invented field.
 */
export const manualLeadSchema = z
  .object({
    fullName: z.string().trim().min(1, "Enter a name").max(120, "Name is too long"),
    mobile: z.string().trim().min(5, "Enter a valid mobile number").max(20, "Mobile number is too long"),
    email: z.string().trim().max(160).optional(),
    source: z.enum(MANUAL_LEAD_SOURCES, { error: "Select the lead source" }),
    serviceType: z.enum(serviceTypeValues, { error: "Select a service" }),
    /** Required only when serviceType === "OTHER" — enforced below, not by the field's own optionality. */
    otherServiceDescription: z.string().trim().max(200, "Keep it under 200 characters").optional(),
    /** Client doc 16 Nov (D5 / E6) — not asked for Visa Change / Visa Extension (enforced below for the others). */
    travelDate: z.string(),
    adultCount: z.number().int().min(1, "At least 1 adult traveller is required"),
    childCount: z.number().int().min(0),
    infantCount: z.number().int().min(0),
    couponCode: z.string().trim().max(40).optional(),
    /** "permitted extra charges" per the client's own wording — mirrors Quotation.fineOrCharges. */
    extraCharges: z.number().min(0).optional(),
    // New Visa pricing lookup
    destinationCountryCode: z.string().trim().optional(),
    /** Client doc 2026-10-20 (K1) — the visa option (stay · entry · category) and nationality, as on the website. */
    newVisaConfigId: z.string().trim().optional(),
    nationalityId: z.string().trim().optional(),
    /** Client doc 2026-10-20 (K1) — Visa Extension / Visa Change: the current visa's expiry date. */
    visaExpiryDate: z.string().trim().optional(),
    /** Client doc 16 Nov (E6) — Visa Extension: each passenger's passport number, for staff verification. */
    passportNumbers: z.array(z.string().trim().max(20, "Passport number is too long")).optional(),
    // Shared by New Visa and OTB
    processingType: z.enum(["normal", "urgent"]).optional(),
    // OTB pricing lookup
    airlineCode: z.string().trim().optional(),
    // Return Ticket pricing lookup
    returnTicketDestinationCountryId: z.string().trim().optional(),
    /** Client update (2026-09-24): the customer's target return date, replacing the old visa-type selection. */
    returnTicketExpectedReturnDate: z.string().trim().optional(),
    /** Client doc 16 Nov (A1) — Special Fare: departure / arrival city or airport, and a return date for a round trip. */
    flightOrigin: z.string().trim().max(160).optional(),
    flightDestination: z.string().trim().max(160).optional(),
    flightReturnDate: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.serviceType === "OTHER" && !data.otherServiceDescription) {
      ctx.addIssue({ code: "custom", message: "Describe the service", path: ["otherServiceDescription"] });
    }
    if (data.serviceType === "NEW_VISA") {
      if (!data.destinationCountryCode) ctx.addIssue({ code: "custom", message: "Select a destination country", path: ["destinationCountryCode"] });
      if (!data.processingType) ctx.addIssue({ code: "custom", message: "Select a processing type", path: ["processingType"] });
    }
    const visaStatusChange = data.serviceType === "VISA_EXTENSION" || data.serviceType === "VISA_CHANGE";
    if (!visaStatusChange && !data.travelDate) {
      ctx.addIssue({ code: "custom", message: "Select a travel date", path: ["travelDate"] });
    }
    if (visaStatusChange && !data.visaExpiryDate) {
      ctx.addIssue({ code: "custom", message: "Select the visa expiry date", path: ["visaExpiryDate"] });
    }
    if (data.serviceType === "VISA_EXTENSION") {
      const count = data.adultCount + data.childCount + data.infantCount;
      for (let i = 0; i < count; i++) {
        if ((data.passportNumbers?.[i] ?? "").length < 5) ctx.addIssue({ code: "custom", message: "Enter the passport number", path: ["passportNumbers", i] });
      }
    }
    if (data.serviceType === "OTB") {
      if (!data.destinationCountryCode) ctx.addIssue({ code: "custom", message: "Select a destination country", path: ["destinationCountryCode"] });
      if (!data.airlineCode) ctx.addIssue({ code: "custom", message: "Select an airline", path: ["airlineCode"] });
      if (!data.processingType) ctx.addIssue({ code: "custom", message: "Select a processing type", path: ["processingType"] });
    }
    if (data.serviceType === "FLIGHT_SPECIAL_FARE") {
      if (!data.flightOrigin) ctx.addIssue({ code: "custom", message: "Enter the departure city or airport", path: ["flightOrigin"] });
      if (!data.flightDestination) ctx.addIssue({ code: "custom", message: "Enter the arrival city or airport", path: ["flightDestination"] });
      if (data.flightOrigin && data.flightDestination && data.flightOrigin.toLowerCase() === data.flightDestination.toLowerCase()) {
        ctx.addIssue({ code: "custom", message: "Arrival must be different from departure", path: ["flightDestination"] });
      }
      if (data.flightReturnDate && data.travelDate && data.flightReturnDate < data.travelDate) {
        ctx.addIssue({ code: "custom", message: "The return date must be on or after the travel date", path: ["flightReturnDate"] });
      }
    }
    if (data.serviceType === "RETURN_TICKET") {
      if (!data.returnTicketDestinationCountryId) {
        ctx.addIssue({ code: "custom", message: "Select a destination", path: ["returnTicketDestinationCountryId"] });
      }
      if (!data.returnTicketExpectedReturnDate) {
        ctx.addIssue({ code: "custom", message: "Select an expected return date", path: ["returnTicketExpectedReturnDate"] });
      }
    }
  });

export type ManualLeadValues = z.infer<typeof manualLeadSchema>;

/** The 3 services this form can auto-price — matches createAutoCheckout's own Extract<ServiceType, ...>. */
export const FIXED_RATE_SERVICE_TYPES = ["NEW_VISA", "OTB", "RETURN_TICKET"] as const;
export type FixedRateServiceType = (typeof FIXED_RATE_SERVICE_TYPES)[number];

export function isFixedRateService(serviceType: ServiceTypeT): serviceType is FixedRateServiceType {
  return (FIXED_RATE_SERVICE_TYPES as readonly ServiceTypeT[]).includes(serviceType);
}
