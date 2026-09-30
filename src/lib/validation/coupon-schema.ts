import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";
import {
  CouponType,
  CouponCategory,
  type CouponType as CouponTypeType,
  type CouponCategory as CouponCategoryType,
} from "../../generated/prisma/enums";

const couponTypeValues = Object.values(CouponType) as [CouponTypeType, ...CouponTypeType[]];
const couponCategoryValues = Object.values(CouponCategory) as [CouponCategoryType, ...CouponCategoryType[]];
const isoDate = (message: string) => z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), message);

const couponBaseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Enter a code of at least 3 characters")
    .max(30, "Code is too long")
    .transform((value) => value.toUpperCase()),
  type: z.enum(couponTypeValues, { error: "Select a coupon type" }),
  /** CRM.md §8 / ADMIN.md §25 (Step 22) — Employee/External/Abandoned Quotation. */
  category: z.enum(couponCategoryValues, { error: "Select a coupon category" }),
  value: z.number({ error: "Enter the coupon value" }).positive("Value must be greater than 0"),
  validFrom: isoDate("Enter a valid start date"),
  validUntil: isoDate("Enter a valid end date"),
  /** null/omitted = unlimited uses. */
  usageLimit: z.number().int().positive("Usage limit must be at least 1").nullable().optional(),
  /**
   * P24 — per-coupon cap on the discount in rupees (null/omitted = no cap).
   * For a PERCENTAGE coupon the discount is min(percent × amount, maxDiscount);
   * for FIXED_AMOUNT it only bites when set below the coupon's own value.
   */
  maxDiscount: z.number({ error: "Enter a maximum discount amount" }).positive("Max discount must be greater than 0").nullable().optional(),
  active: z.boolean().default(true),
});

function crossFieldChecks(value: z.infer<typeof couponBaseSchema>, ctx: z.RefinementCtx) {
  if (new Date(value.validUntil) <= new Date(value.validFrom)) {
    ctx.addIssue({ code: "custom", message: "End date must be after the start date", path: ["validUntil"] });
  }
  if (value.type === "PERCENTAGE" && value.value > 100) {
    ctx.addIssue({ code: "custom", message: "A percentage discount can't exceed 100", path: ["value"] });
  }
}

export const createCouponSchema = couponBaseSchema.superRefine(crossFieldChecks);
export const updateCouponSchema = partialUpdateSchema(couponBaseSchema);

export type CreateCouponValues = z.infer<typeof createCouponSchema>;
export type UpdateCouponValues = z.infer<typeof updateCouponSchema>;
