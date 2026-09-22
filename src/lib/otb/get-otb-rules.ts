import { db } from "../db";
import {
  DEFAULT_STANDARD_PROCESSING_WORKING_DAYS,
  DEFAULT_URGENT_PROCESSING_WORKING_HOURS,
  type OtbAirlineRules,
} from "./processing-rules";

export const OTB_RULE_CONFIG_ID = "singleton";

export interface OtbGlobalRules {
  standardProcessingDays: number;
  /** Working hours (client answer, 2026-09-23) — not days. */
  urgentProcessingHours: number | null;
}

/** Global timelines; falls back to the client's confirmed 24 working days / 8 working hours if the seeded singleton row is somehow missing. */
export async function getOtbGlobalRules(): Promise<OtbGlobalRules> {
  const config = await db.otbRuleConfig.findUnique({ where: { id: OTB_RULE_CONFIG_ID } });
  return {
    standardProcessingDays: config?.standardProcessingDays ?? DEFAULT_STANDARD_PROCESSING_WORKING_DAYS,
    urgentProcessingHours: config?.urgentProcessingHours ?? DEFAULT_URGENT_PROCESSING_WORKING_HOURS,
  };
}

/** An airline's own timelines override the global ones; urgent is only offered when it has an urgent price. */
export function resolveAirlineRules(
  airline: { standardProcessingDays: number | null; urgentProcessingHours: number | null; urgentPrice: unknown },
  global: OtbGlobalRules
): OtbAirlineRules {
  return {
    standardDays: airline.standardProcessingDays ?? global.standardProcessingDays,
    urgentHours: airline.urgentProcessingHours ?? global.urgentProcessingHours,
    urgentAvailable: airline.urgentPrice !== null && airline.urgentPrice !== undefined,
  };
}
