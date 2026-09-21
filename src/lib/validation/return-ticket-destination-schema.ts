import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";
import { RETURN_TICKET_VISA_TYPES } from "@/lib/leads/compute-return-date";

export const createReturnTicketDestinationSchema = z.object({
  countryId: z.string().min(1, "Select a country"),
  ratePerApplicant: z.number({ error: "Enter the rate" }).min(0, "Rate can't be negative").max(1_000_000, "Rate is too large"),
  validityOptions: z
    .array(z.enum(RETURN_TICKET_VISA_TYPES))
    .min(1, "Enable at least one visa-validity option")
    .transform((values) => Array.from(new Set(values))),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateReturnTicketDestinationSchema = partialUpdateSchema(createReturnTicketDestinationSchema);
