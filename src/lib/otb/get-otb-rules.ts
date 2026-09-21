import { db } from "../db";
import { DEFAULT_STANDARD_PROCESSING_WORKING_DAYS, type OtbAirlineRules } from "./processing-rules";

export const OTB_RULE_CONFIG_ID = "singleton";

export interface OtbGlobalRules {
  standardProcessingDays: number;
  urgentProcessingDays: number | null;
}

/** Global timelines; falls back to the client's 24 working days if the seeded singleton row is somehow missing. */
export async function getOtbGlobalRules(): Promise<OtbGlobalRules> {
  const config = await db.otbRuleConfig.findUnique({ where: { id: OTB_RULE_CONFIG_ID } });
  return {
    standardProcessingDays: config?.standardProcessingDays ?? DEFAULT_STANDARD_PROCESSING_WORKING_DAYS,
    urgentProcessingDays: config?.urgentProcessingDays ?? null,
  };
}

/** An airline's own timelines override the global ones; urgent is only offered when it has an urgent price. */
export function resolveAirlineRules(
  airline: { standardProcessingDays: number | null; urgentProcessingDays: number | null; urgentPrice: unknown },
  global: OtbGlobalRules
): OtbAirlineRules {
  return {
    standardDays: airline.standardProcessingDays ?? global.standardProcessingDays,
    urgentDays: airline.urgentProcessingDays ?? global.urgentProcessingDays,
    urgentAvailable: airline.urgentPrice !== null && airline.urgentPrice !== undefined,
  };
}
