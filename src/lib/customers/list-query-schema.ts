import { z } from "zod";

/** Query string for GET /api/customers (CRM.md §23 Customers list). */
export const customerListQuerySchema = z.object({
  /** Matches name, mobile, email, any passenger's passport number, or any lead/booking reference. */
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type CustomerListQueryValues = z.infer<typeof customerListQuerySchema>;
