import { z } from "zod";
import { CouponType, type CouponType as CouponTypeType } from "../../generated/prisma/enums";

const couponTypeValues = Object.values(CouponType) as [CouponTypeType, ...CouponTypeType[]];
const isoDate = (message: string) => z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), message);

const couponBaseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Enter a code of at least 3 characters")
    .max(30, "Code is too long")
    .transform((value) => value.toUpperCase()),
  type: z.enum(couponTypeValues, { error: "Select a coupon type" }),
  value: z.number({ error: "Enter the coupon value" }).positive("Value must be greater than 0"),
  validFrom: isoDate("Enter a valid start date"),
  validUntil: isoDate("Enter a valid end date"),
  /** null/omitted = unlimited uses. */
  usageLimit: z.number().int().positive("Usage limit must be at least 1").nullable().optional(),
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
export const updateCouponSchema = couponBaseSchema.partial();

export type CreateCouponValues = z.infer<typeof createCouponSchema>;
export type UpdateCouponValues = z.infer<typeof updateCouponSchema>;
