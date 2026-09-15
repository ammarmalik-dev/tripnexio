import { z } from "zod";

export const updateCouponConfigSchema = z.object({
  employeeCouponCap: z.coerce.number().positive("Enter a cap greater than 0."),
});

export type UpdateCouponConfigValues = z.infer<typeof updateCouponConfigSchema>;
