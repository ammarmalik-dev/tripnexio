/**
 * The sub-service shown next to the service in CRM lists (client
 * corrections 2026-10-05: "Service/Sub-service" column), read from what the
 * intake form stored. null when the service has no sub-service choice.
 */
const CHANGE_TYPE_LABELS: Record<string, string> = {
  AIRPORT_TO_AIRPORT: "Airport-to-Airport",
  BORDER_EXIT: "Border Exit & Re-entry",
};

export function subServiceLabel(details: unknown): string | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const record = details as Record<string, unknown>;
  if (typeof record.changeType === "string") return CHANGE_TYPE_LABELS[record.changeType] ?? null;
  // Client doc 2026-10-15 (C4) — visas show the visa type / option; Normal / Urgent moved under the ID
  // (src/lib/crm/list-labels.ts), airlines are resolved there too.
  if (typeof record.visaOption === "string" && record.visaOption.trim()) return record.visaOption.trim();
  if (typeof record.visaType === "string" && record.visaType.trim()) return record.visaType.trim();
  return null;
}
