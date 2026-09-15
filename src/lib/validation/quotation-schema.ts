import { z } from "zod";

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
  flightDateTime: isoDate("Enter a valid departure date/time").optional(),
  arrivalDateTime: isoDate("Enter a valid arrival date/time").optional(),
  baggageAllowance: z.string().trim().min(1).optional(),
  fareType: z.string().trim().min(1).optional(),
  adultFare: z.number().nonnegative("Adult fare can't be negative").optional(),
  childFare: z.number().nonnegative("Child fare can't be negative").optional(),
  infantFare: z.number().nonnegative("Infant fare can't be negative").optional(),
  sellingPrice: z.number().nonnegative("Selling price can't be negative").optional(),

  // Visa services / OTB fields (simple fee-based quote)
  feeAmount: z.number().nonnegative("Fee can't be negative").optional(),
  fineOrCharges: z.number().nonnegative("Fine/charges can't be negative").optional(),

  /** CRM.md §10 (Step 22) — resolved and validated server-side; rejected outright for a flight quote. Empty string clears an already-applied coupon. */
  couponCode: z.string().trim().optional(),
});

export const updateQuotationSchema = createQuotationSchema.omit({ leadId: true }).partial();

/** What the quote-builder form itself collects — leadId is supplied by the page, not the form. */
export const quoteFormSchema = createQuotationSchema.omit({ leadId: true });

/**
 * Adds the same "sellingPrice required for flight quotes, feeAmount required
 * otherwise" rule the API enforces server-side (see
 * `src/lib/quotations/pricing.ts`) — kept as a refinement rather than baked
 * into the base schema because the requiredness depends on the lead's
 * serviceType, which the shared schema itself doesn't know about.
 */
export function buildQuoteFormSchema(isFlightQuote: boolean) {
  return quoteFormSchema.superRefine((data, ctx) => {
    if (isFlightQuote && data.sellingPrice == null) {
      ctx.addIssue({ code: "custom", message: "Enter the selling price.", path: ["sellingPrice"] });
    }
    if (!isFlightQuote && data.feeAmount == null) {
      ctx.addIssue({ code: "custom", message: "Enter the fee amount.", path: ["feeAmount"] });
    }
  });
}

export type CreateQuotationValues = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationValues = z.infer<typeof updateQuotationSchema>;
export type QuoteFormValues = z.infer<typeof quoteFormSchema>;
