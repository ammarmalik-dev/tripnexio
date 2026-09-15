import { db } from "../db";

/** True singleton, same pattern as TaxFeeConfig — see prisma/schema.prisma's ProtectionPlanConfig doc comment. */
export const PROTECTION_PLAN_CONFIG_ID = "singleton";

const FALLBACK_DEFAULT_PRICE = 5000;

/** Used wherever a plan is offered — reads the current admin-configured price to snapshot onto the new ProtectionPlan row. */
export async function getProtectionPlanDefaultPrice(): Promise<number> {
  const config = await db.protectionPlanConfig.findUnique({ where: { id: PROTECTION_PLAN_CONFIG_ID } });
  return config ? Number(config.defaultPrice) : FALLBACK_DEFAULT_PRICE;
}
