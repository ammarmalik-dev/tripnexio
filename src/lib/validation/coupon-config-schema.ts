import { z } from "zod";
import { CouponType, type CouponType as CouponTypeType } from "../../generated/prisma/enums";

const couponTypeValues = Object.values(CouponType) as [CouponTypeType, ...CouponTypeType[]];

/**
 * Every field optional (PATCH) — the Employee cap card and the P24
 * abandoned-quotation coupon card save independently. Cross-field rules
 * (enabling requires the full configuration, percentage <= 100) are checked
 * against the MERGED row in the route, since a partial body can't see them.
 */
export const updateCouponConfigSchema = z.object({
  employeeCouponCap: z.number({ error: "Enter the cap" }).positive("Enter a cap greater than 0.").optional(),
  abandonedCouponEnabled: z.boolean().optional(),
  abandonedAfterHours: z.number().int("Enter whole hours").min(1, "Must be at least 1 hour").max(2160, "Can't exceed 2160 hours (90 days)").nullable().optional(),
  abandonedCouponType: z.enum(couponTypeValues, { error: "Select a coupon type" }).nullable().optional(),
  abandonedCouponValue: z.number().positive("Value must be greater than 0").nullable().optional(),
  abandonedCouponMaxDiscount: z.number().positive("Max discount must be greater than 0").nullable().optional(),
  abandonedCouponValidDays: z.number().int("Enter whole days").min(1, "Must be at least 1 day").max(365, "Can't exceed 365 days").nullable().optional(),
});

export type UpdateCouponConfigValues = z.infer<typeof updateCouponConfigSchema>;
