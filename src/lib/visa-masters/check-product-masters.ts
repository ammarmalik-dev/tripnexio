import { db } from "../db";

/**
 * Client corrections 2026-10-05 — a New Visa product's stay must be an active
 * Visa Stay Type and its validity (if set) an active Visa Validity Type.
 * Returns field errors, or null when fine.
 */
export async function checkProductMasters(input: {
  stayDays?: number | null;
  validityTypeId?: string | null;
  entryKind?: string | null;
}): Promise<Record<string, string[]> | null> {
  const errors: Record<string, string[]> = {};
  // Client doc 16 Nov (K8) — the entry type must be an active Visa Entry Type.
  if (input.entryKind && !(await db.visaEntryType.findFirst({ where: { code: input.entryKind, active: true }, select: { id: true } }))) {
    errors.entryKind = ["Pick an active entry type from Visa Entry Types."];
  }
  if (input.stayDays != null && !(await db.visaStayType.findFirst({ where: { days: input.stayDays, active: true }, select: { id: true } }))) {
    errors.stayDays = ["Pick an active stay from Visa Stay Types."];
  }
  if (input.validityTypeId && !(await db.visaValidityType.findFirst({ where: { id: input.validityTypeId, active: true }, select: { id: true } }))) {
    errors.validityTypeId = ["Pick an active Visa Validity Type."];
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

/** Client doc 16 Nov (K8) — the master's name for an entry type code (null when unknown). */
export async function entryTypeName(code: string): Promise<string | null> {
  return (await db.visaEntryType.findUnique({ where: { code }, select: { name: true } }))?.name ?? null;
}
