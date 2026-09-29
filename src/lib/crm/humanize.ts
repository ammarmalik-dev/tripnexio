import { processingTypeLabel, type ProcessingTypeView } from "@/lib/processing-types/defaults";
import type { ServiceType } from "../../generated/prisma/enums";

/** "destinationCountry" -> "Destination Country" — for rendering Lead.details JSON keys generically. */
export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

/**
 * Display value for a Lead.details entry. P23 — a stored processingType code
 * ("normal"/"urgent") is labelled from the Admin Processing Types master when
 * `processingTypes` is passed (see `useProcessingTypes`), falling back to the
 * historical Normal / Express (New Visa) or Normal / Urgent labels.
 */
export function formatDetailValue(
  serviceType: ServiceType,
  key: string,
  value: unknown,
  processingTypes?: ProcessingTypeView[] | null
): string {
  if (key === "processingType" && typeof value === "string") {
    return processingTypeLabel(serviceType, value, processingTypes);
  }
  return String(value);
}
