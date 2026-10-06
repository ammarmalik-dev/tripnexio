import { db } from "../db";

/**
 * Client corrections 2026-10-05 — a New Visa product's stay must be an active
 * Visa Stay Type and its validity (if set) an active Visa Validity Type.
 * Returns field errors, or null when fine.
 */
export async function checkProductMasters(input: { stayDays?: number | null; validityTypeId?: string | null }): Promise<Record<string, string[]> | null> {
  const errors: Record<string, string[]> = {};
  if (input.stayDays != null && !(await db.visaStayType.findFirst({ where: { days: input.stayDays, active: true }, select: { id: true } }))) {
    errors.stayDays = ["Pick an active stay from Visa Stay Types."];
  }
  if (input.validityTypeId && !(await db.visaValidityType.findFirst({ where: { id: input.validityTypeId, active: true }, select: { id: true } }))) {
    errors.validityTypeId = ["Pick an active Visa Validity Type."];
  }
  return Object.keys(errors).length > 0 ? errors : null;
}
