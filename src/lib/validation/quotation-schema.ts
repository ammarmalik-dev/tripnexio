import { z } from "zod";

const isoDate = (message: string) => z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), message);

export const createQuotationSchema = z.object({
  leadId: z.string().min(1, "Select a lead"),
  vendorId: z.string().min(1, "Select a vendor"),
  airline: z.string().trim().min(1).optional(),
  flightNumber: z.string().trim().min(1).optional(),
  route: z.string().trim().min(1).optional(),
  flightDateTime: isoDate("Enter a valid flight date/time").optional(),
  vendorCost: z.number({ error: "Enter the vendor cost" }).nonnegative("Vendor cost can't be negative"),
  sellingPrice: z.number({ error: "Enter the selling price" }).nonnegative("Selling price can't be negative"),
  validityExpiresAt: isoDate("Enter a valid validity expiry date").optional(),
  alternativeOfId: z.string().min(1).optional(),
});

export const updateQuotationSchema = createQuotationSchema.omit({ leadId: true }).partial();

export type CreateQuotationValues = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationValues = z.infer<typeof updateQuotationSchema>;
