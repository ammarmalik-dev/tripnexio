import { z } from "zod";
import { ServiceType, type ServiceType as ServiceTypeType } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeType, ...ServiceTypeType[]];

export const PRICING_RULE_STATUSES = ["active", "expired", "upcoming", "inactive"] as const;
export type PricingRuleStatus = (typeof PRICING_RULE_STATUSES)[number];

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), "Enter a valid date");

/** P23 — Admin Pricing Dashboard filters (query-string values; empty strings are dropped before parsing). */
export const pricingDashboardQuerySchema = z.object({
  countryId: z.string().min(1).optional(),
  serviceType: z.enum(serviceTypeValues).optional(),
  subServiceId: z.string().min(1).optional(),
  visaTypeId: z.string().min(1).optional(),
  processingType: z.string().min(1).max(40).optional(),
  active: z.enum(["true", "false"]).optional(),
  status: z.enum(PRICING_RULE_STATUSES).optional(),
  /** Rules in effect on this date: validityFrom ≤ date ≤ validityUntil, a null bound is open. */
  effectiveDate: dateOnly.optional(),
  /** Rules whose validityUntil falls between today and today + N days. */
  expiringWithinDays: z.coerce.number().int().min(0).max(3650).optional(),
  includeOptions: z.enum(["1"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type PricingDashboardQuery = z.infer<typeof pricingDashboardQuerySchema>;
