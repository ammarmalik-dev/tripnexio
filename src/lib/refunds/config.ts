import { db } from "../db";
import type { RefundCutoff, ServiceType } from "../../generated/prisma/enums";

export interface RefundConfigValues {
  fullRefundWindowHours: number | null;
  preValidationDeduction: number;
  postValidationDeduction: number;
  noRefundAfter: RefundCutoff;
}

/**
 * Used only when a service has no RefundConfig row — the same values the
 * 20260929030000_locked_value_fixes migration inserts (locked client refund
 * policy). Admin → Refund Configuration is the real source.
 */
export const DEFAULT_REFUND_CONFIG: Record<ServiceType, RefundConfigValues> = {
  NEW_VISA: { fullRefundWindowHours: 4, preValidationDeduction: 250, postValidationDeduction: 250, noRefundAfter: "EXTERNAL_SUBMISSION" },
  OTB: { fullRefundWindowHours: null, preValidationDeduction: 0, postValidationDeduction: 250, noRefundAfter: "EXTERNAL_SUBMISSION" },
  VISA_CHANGE: { fullRefundWindowHours: null, preValidationDeduction: 250, postValidationDeduction: 250, noRefundAfter: "PACKAGE_GENERATED" },
  RETURN_TICKET: { fullRefundWindowHours: null, preValidationDeduction: 0, postValidationDeduction: 0, noRefundAfter: "EXTERNAL_SUBMISSION" },
  VISA_EXTENSION: { fullRefundWindowHours: null, preValidationDeduction: 0, postValidationDeduction: 0, noRefundAfter: "NEVER" },
  FLIGHT_SPECIAL_FARE: { fullRefundWindowHours: null, preValidationDeduction: 0, postValidationDeduction: 0, noRefundAfter: "NEVER" },
  OTHER: { fullRefundWindowHours: null, preValidationDeduction: 0, postValidationDeduction: 0, noRefundAfter: "NEVER" },
};

export async function getRefundConfig(serviceType: ServiceType): Promise<RefundConfigValues> {
  const row = await db.refundConfig.findUnique({ where: { serviceType } });
  if (!row) return DEFAULT_REFUND_CONFIG[serviceType];
  return {
    fullRefundWindowHours: row.fullRefundWindowHours,
    preValidationDeduction: Number(row.preValidationDeduction),
    postValidationDeduction: Number(row.postValidationDeduction),
    noRefundAfter: row.noRefundAfter,
  };
}
