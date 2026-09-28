/** "destinationCountry" -> "Destination Country" — for rendering Lead.details JSON keys generically. */
export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

/**
 * Display value for a Lead.details entry. New Visa's stored "urgent" is
 * labelled "Express" (UAE Visa Page Content FINAL §14); OTB keeps "Urgent".
 */
export function formatDetailValue(serviceType: string, key: string, value: unknown): string {
  if (key === "processingType" && typeof value === "string") {
    if (value === "normal") return "Normal";
    if (value === "urgent") return serviceType === "NEW_VISA" ? "Express" : "Urgent";
  }
  return String(value);
}
