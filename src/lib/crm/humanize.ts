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
  if (key === "changeType" && typeof value === "string") {
    return value === "AIRPORT_TO_AIRPORT" ? "Airport-to-Airport" : value === "BORDER_EXIT" ? "Border Exit" : value;
  }
  return plainValue(value);
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** A readable value for any JSON shape: nested objects / lists read as text, never "[object Object]". */
function plainValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && ISO_TIMESTAMP.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }
  }
  if (Array.isArray(value)) return value.length ? value.map(plainValue).join(", ") : "—";
  if (typeof value === "object") {
    const parts = Object.entries(value as Record<string, unknown>)
      .filter(([, inner]) => inner !== null && inner !== undefined && inner !== "")
      .map(([innerKey, inner]) => `${humanizeKey(innerKey)}: ${plainValue(inner)}`);
    return parts.length ? parts.join(" · ") : "—";
  }
  return String(value);
}
