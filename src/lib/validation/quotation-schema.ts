import { z } from "zod";
import { itinerarySchema } from "../quotations/itinerary";

const isoDate = (message: string) => z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), message);

export const createQuotationSchema = z.object({
  leadId: z.string().min(1, "Select a lead"),
  vendorId: z.string().min(1, "Select a vendor"),
  vendorCost: z.number({ error: "Enter the vendor cost" }).nonnegative("Vendor cost can't be negative"),
  validityExpiresAt: isoDate("Enter a valid validity expiry date/time").optional(),
  alternativeOfId: z.string().min(1).optional(),

  // Flight Special Fare fields
  airline: z.string().trim().min(1).optional(),
  flightNumber: z.string().trim().min(1).optional(),
  route: z.string().trim().min(1).optional(),
  /** Client corrections 2026-10-05 — Special Fare route from the Airport master (IATA codes); the server derives route + Domestic/International. */
  fromAirportCode: z.string().trim().min(3).max(4).optional(),
  toAirportCode: z.string().trim().min(3).max(4).optional(),
  flightDateTime: isoDate("Enter a valid departure date/time").optional(),
  arrivalDateTime: isoDate("Enter a valid arrival date/time").optional(),
  baggageAllowance: z.string().trim().min(1).optional(),
  fareType: z.string().trim().min(1).optional(),
  adultFare: z.number().nonnegative("Adult fare can't be negative").optional(),
  childFare: z.number().nonnegative("Child fare can't be negative").optional(),
  infantFare: z.number().nonnegative("Infant fare can't be negative").optional(),
  sellingPrice: z.number().nonnegative("Selling price can't be negative").optional(),

  // P15 — Flight Special Fare quote details and cancellation terms (Locked
  // v2.0 Q17: no universal cancellation charge — staff enter them per quote).
  terminal: z.string().trim().max(60).optional(),
  reportingTime: z.string().trim().max(60).optional(),
  fareRules: z.string().trim().max(2000).optional(),
  restrictions: z.string().trim().max(2000).optional(),
  /** Internal only — never shown to the customer. */
  vendorReference: z.string().trim().max(120).optional(),
  bookingDeadline: isoDate("Enter a valid booking deadline").optional(),
  cancellationAllowed: z.boolean().optional(),
  cancellationCharge: z.number().nonnegative("Cancellation charge can't be negative").optional(),
  chargeBasis: z.string().trim().max(120).optional(),
  timeCondition: z.string().trim().max(200).optional(),
  noShowCharge: z.number().nonnegative("No-show charge can't be negative").optional(),
  estimatedRefund: z.number().nonnegative("Estimated refund can't be negative").optional(),
  customerCancellationPolicy: z.string().trim().max(3000).optional(),

  // Visa services / OTB fields (simple fee-based quote)
  feeAmount: z.number().nonnegative("Fee can't be negative").optional(),
  fineOrCharges: z.number().nonnegative("Fine/charges can't be negative").optional(),
  /** P13 — Visa Extension quote breakdown: other charges, added to the total. */
  otherCharges: z.number().nonnegative("Other charges can't be negative").optional(),
  /** Visa Change itinerary options only — ignored for every other service type. */
  flightTicketPrice: z.number().nonnegative("Flight ticket price can't be negative").optional(),
  /** Client corrections 2026-10-05 — government / airline fee inside the total, shown apart on the invoice (no GST). */
  governmentFee: z.number().nonnegative("Government / airline fee can't be negative").optional(),
  /** Client corrections 2026-10-05 — Visa Change package inclusions / exclusions (ignored for other services). */
  inclusions: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  exclusions: z.array(z.string().trim().min(1).max(120)).max(20).optional(),

  /** CRM.md §10 (Step 22) — resolved and validated server-side; rejected outright for a flight quote. Empty string clears an already-applied coupon. */
  couponCode: z.string().trim().optional(),

  /**
   * P22 — multi-sector itinerary (Visa Change / Flight Special Fare only;
   * the API derives the service type server-side and rejects a non-empty
   * itinerary for any other service). An empty array clears it.
   */
  itinerary: itinerarySchema.optional(),

  /**
   * P22 — true creates the quotation as an unsent draft (isDraft=true,
   * sentAt=null): no customer notification, no lead-status/engine event,
   * invisible to the customer, and it can't be selected/booked/paid until
   * POST /api/quotations/[id]/send.
   */
  saveAsDraft: z.boolean().optional(),
});

export const updateQuotationSchema = createQuotationSchema.omit({ leadId: true, saveAsDraft: true }).partial();

/** What the quote-builder form itself collects — leadId is supplied by the page, and draft-vs-send by which button was pressed. */
export const quoteFormSchema = createQuotationSchema.omit({ leadId: true, saveAsDraft: true });

/** P22 — POST /api/quotations/[id]/send: optionally restart the validity clock at send time. */
export const sendQuotationSchema = z.object({
  validityExpiresAt: isoDate("Enter a valid validity expiry date/time").optional(),
});

/**
 * Adds the same "sellingPrice required for flight quotes, feeAmount required
 * otherwise" rule the API enforces server-side (see
 * `src/lib/quotations/pricing.ts`) — kept as a refinement rather than baked
 * into the base schema because the requiredness depends on the lead's
 * serviceType, which the shared schema itself doesn't know about.
 */
export function buildQuoteFormSchema(isFlightQuote: boolean) {
  return quoteFormSchema.superRefine((data, ctx) => {
    if (isFlightQuote && !data.fromAirportCode) {
      ctx.addIssue({ code: "custom", message: "Select the departure airport.", path: ["fromAirportCode"] });
    }
    if (isFlightQuote && !data.toAirportCode) {
      ctx.addIssue({ code: "custom", message: "Select the arrival airport.", path: ["toAirportCode"] });
    }
    if (isFlightQuote && data.fromAirportCode && data.fromAirportCode === data.toAirportCode) {
      ctx.addIssue({ code: "custom", message: "Arrival must be a different airport.", path: ["toAirportCode"] });
    }
    if (isFlightQuote && data.sellingPrice == null) {
      ctx.addIssue({ code: "custom", message: "Enter the selling price.", path: ["sellingPrice"] });
    }
    if (!isFlightQuote && data.feeAmount == null) {
      ctx.addIssue({ code: "custom", message: "Enter the fee amount.", path: ["feeAmount"] });
    }
  });
}

/** Business Rules §9 "Staff revalidation" + §14 "Sensitive Admin Actions" — reason is the required extra-confirmation text, folded into the audit note. */
export const revalidateQuotationSchema = z.object({
  validityExpiresAt: isoDate("Enter a valid validity expiry date/time"),
  reason: z.string().trim().min(5, "Enter a reason (at least 5 characters)."),
});

export type CreateQuotationValues = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationValues = z.infer<typeof updateQuotationSchema>;
export type QuoteFormValues = z.infer<typeof quoteFormSchema>;
