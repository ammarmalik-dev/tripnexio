import { z } from "zod";
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
    source: z.string().trim().min(1, "Enter how the customer contacted us").max(80, "Keep it under 80 characters"),
    serviceType: z.enum(serviceTypeValues, { error: "Select a service" }),
    /** Required only when serviceType === "OTHER" — enforced below, not by the field's own optionality. */
    otherServiceDescription: z.string().trim().max(200, "Keep it under 200 characters").optional(),
    travelDate: z.string().min(1, "Select a travel date"),
    adultCount: z.number().int().min(1, "At least 1 adult traveller is required"),
    childCount: z.number().int().min(0),
    infantCount: z.number().int().min(0),
    couponCode: z.string().trim().max(40).optional(),
    /** "permitted extra charges" per the client's own wording — mirrors Quotation.fineOrCharges. */
    extraCharges: z.number().min(0).optional(),
    // New Visa pricing lookup
    destinationCountryCode: z.string().trim().optional(),
    // Shared by New Visa and OTB
    processingType: z.enum(["normal", "urgent"]).optional(),
    // OTB pricing lookup
    airlineCode: z.string().trim().optional(),
    // Return Ticket pricing lookup
    returnTicketDestinationCountryId: z.string().trim().optional(),
    /** Client update (2026-09-24): the customer's target return date, replacing the old visa-type selection. */
    returnTicketExpectedReturnDate: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.serviceType === "OTHER" && !data.otherServiceDescription) {
      ctx.addIssue({ code: "custom", message: "Describe the service", path: ["otherServiceDescription"] });
    }
    if (data.serviceType === "NEW_VISA") {
      if (!data.destinationCountryCode) ctx.addIssue({ code: "custom", message: "Select a destination country", path: ["destinationCountryCode"] });
      if (!data.processingType) ctx.addIssue({ code: "custom", message: "Select a processing type", path: ["processingType"] });
    }
    if (data.serviceType === "OTB") {
      if (!data.airlineCode) ctx.addIssue({ code: "custom", message: "Select an airline", path: ["airlineCode"] });
      if (!data.processingType) ctx.addIssue({ code: "custom", message: "Select a processing type", path: ["processingType"] });
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
