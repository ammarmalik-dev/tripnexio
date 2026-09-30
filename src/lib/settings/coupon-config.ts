import { db } from "../db";
import type { CouponType } from "../../generated/prisma/enums";

/** True singleton, same pattern as TaxFeeConfig/ProtectionPlanConfig. */
export const COUPON_CONFIG_ID = "singleton";

// ADMIN.md §25's own current figure — only used if the seeded singleton
// row is somehow missing, should not happen in practice.
const FALLBACK_EMPLOYEE_COUPON_CAP = 500;

export async function getEmployeeCouponCap(): Promise<number> {
  const config = await db.couponConfig.findUnique({ where: { id: COUPON_CONFIG_ID } });
  return config ? Number(config.employeeCouponCap) : FALLBACK_EMPLOYEE_COUPON_CAP;
}

export interface AbandonedCouponSettings {
  afterHours: number;
  type: CouponType;
  value: number;
  maxDiscount: number | null;
  validDays: number;
}

/**
 * P24 — the abandoned-quotation coupon automation's Admin settings, or null
 * when the toggle is off OR any required value (type/value/afterHours/
 * validDays) is still unset — the job does nothing in that case.
 */
export async function getAbandonedCouponSettings(): Promise<AbandonedCouponSettings | null> {
  const config = await db.couponConfig.findUnique({ where: { id: COUPON_CONFIG_ID } });
  if (!config || !config.abandonedCouponEnabled) return null;
  const { abandonedAfterHours, abandonedCouponType, abandonedCouponValue, abandonedCouponValidDays } = config;
  if (abandonedAfterHours == null || abandonedCouponType == null || abandonedCouponValue == null || abandonedCouponValidDays == null) return null;
  return {
    afterHours: abandonedAfterHours,
    type: abandonedCouponType,
    value: Number(abandonedCouponValue),
    maxDiscount: config.abandonedCouponMaxDiscount == null ? null : Number(config.abandonedCouponMaxDiscount),
    validDays: abandonedCouponValidDays,
  };
}
