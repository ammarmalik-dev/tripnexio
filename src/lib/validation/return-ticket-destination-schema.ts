import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";

export const createReturnTicketDestinationSchema = z.object({
  countryId: z.string().min(1, "Select a country"),
  ratePerApplicant: z.number({ error: "Enter the rate" }).min(0, "Rate can't be negative").max(1_000_000, "Rate is too large"),
  /** P17 — per-booking cancellation fee (null = none), shown before payment and used by the refund engine before forwarding. */
  cancellationFee: z.number().min(0, "Fee can't be negative").max(1_000_000, "Fee is too large").nullable().default(null),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateReturnTicketDestinationSchema = partialUpdateSchema(createReturnTicketDestinationSchema);
