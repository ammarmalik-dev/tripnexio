import type { ServiceType } from "../../generated/prisma/enums";

/**
 * P23 — one processing-type option as the forms/CRM see it. `code` is what's
 * stored on leads and pricing ("normal"/"urgent"); `label` is displayed.
 * Client-safe (no DB import) so both the hook and the server helper share it.
 */
export interface ProcessingTypeView {
  code: string;
  label: string;
  description: string | null;
}

/**
 * The pre-master hard-coded pair, kept ONLY as a safety net: used when the
 * `ProcessingTypeOption` master can't be read (DB error) or has no rows at all
 * for a service. New Visa labels "urgent" as "Express" (UAE Visa Page Content
 * FINAL §14); every other service keeps "Urgent".
 */
export function defaultProcessingTypes(serviceType: ServiceType): ProcessingTypeView[] {
  return [
    { code: "normal", label: "Normal", description: null },
    { code: "urgent", label: serviceType === "NEW_VISA" ? "Express" : "Urgent", description: null },
  ];
}

/** Display label for a stored code — master options first, then the fallback pair, then the raw code. */
export function processingTypeLabel(serviceType: ServiceType, code: string, options?: ProcessingTypeView[] | null): string {
  const fromMaster = options?.find((option) => option.code === code);
  if (fromMaster) return fromMaster.label;
  const fallback = defaultProcessingTypes(serviceType).find((option) => option.code === code);
  return fallback ? fallback.label : code;
}
