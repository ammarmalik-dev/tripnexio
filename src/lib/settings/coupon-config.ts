import { db } from "../db";

/** True singleton, same pattern as TaxFeeConfig/ProtectionPlanConfig. */
export const COUPON_CONFIG_ID = "singleton";

// ADMIN.md §25's own current figure — only used if the seeded singleton
// row is somehow missing, should not happen in practice.
const FALLBACK_EMPLOYEE_COUPON_CAP = 500;

export async function getEmployeeCouponCap(): Promise<number> {
  const config = await db.couponConfig.findUnique({ where: { id: COUPON_CONFIG_ID } });
  return config ? Number(config.employeeCouponCap) : FALLBACK_EMPLOYEE_COUPON_CAP;
}
