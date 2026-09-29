import { db } from "../db";
import type { ServiceType } from "../../generated/prisma/enums";
import { defaultProcessingTypes, type ProcessingTypeView } from "./defaults";

/**
 * P23 — the active processing-type options for a service, in Admin order,
 * from the `ProcessingTypeOption` master.
 *
 * Fallback: on a DB error, or when the master has NO rows at all for this
 * service (never configured), returns the historical hard-coded
 * Normal/Express (New Visa) or Normal/Urgent pair so the forms never break.
 * If rows exist but Admin has deactivated some, those are genuinely hidden —
 * a deactivated code is not resurrected by the fallback.
 */
export async function getProcessingTypeOptions(serviceType: ServiceType): Promise<ProcessingTypeView[]> {
  try {
    const rows = await db.processingTypeOption.findMany({
      where: { serviceType },
      orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
      select: { code: true, label: true, description: true, active: true },
    });
    if (rows.length === 0) return defaultProcessingTypes(serviceType);
    return rows.filter((row) => row.active).map(({ code, label, description }) => ({ code, label, description }));
  } catch (error) {
    console.warn(`[processing-types] falling back to defaults for ${serviceType}:`, error);
    return defaultProcessingTypes(serviceType);
  }
}

/** True when `code` is an active processing type for this service (used by the lead intake routes). */
export async function isActiveProcessingType(serviceType: ServiceType, code: string): Promise<boolean> {
  const options = await getProcessingTypeOptions(serviceType);
  return options.some((option) => option.code === code);
}
