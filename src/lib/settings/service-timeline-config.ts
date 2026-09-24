import { db } from "../db";
import type { ServiceType } from "../../generated/prisma/enums";

export interface ServiceTimelineRules {
  documentVerificationHours: number | null;
  expectedCompletionHours: number | null;
  quotationResponseMinutes: number | null;
  paymentDeadlineHours: number | null;
}

const EMPTY_RULES: ServiceTimelineRules = {
  documentVerificationHours: null,
  expectedCompletionHours: null,
  quotationResponseMinutes: null,
  paymentDeadlineHours: null,
};

/**
 * Step 42 — reads the central Timeline/SLA config for one service. Missing
 * row or `active: false` both resolve to all-null ("not configured"),
 * matching this app's usual fail-safe pattern: callers fall back to their
 * own pre-existing hardcoded default rather than guessing.
 */
export async function getServiceTimelineRules(serviceType: ServiceType): Promise<ServiceTimelineRules> {
  const config = await db.serviceTimelineConfig.findUnique({ where: { serviceType } });
  if (!config || !config.active) return EMPTY_RULES;
  return {
    documentVerificationHours: config.documentVerificationHours,
    expectedCompletionHours: config.expectedCompletionHours,
    quotationResponseMinutes: config.quotationResponseMinutes,
    paymentDeadlineHours: config.paymentDeadlineHours,
  };
}
