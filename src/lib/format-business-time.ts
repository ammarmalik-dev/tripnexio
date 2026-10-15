import { getSystemConfig } from "./settings/system-config";

/**
 * A date/time for customer messages in the business timezone (Admin → System Configuration offset,
 * IST by default) — never the server's own timezone, which is UTC on the VPS. Server-side only.
 */
export async function formatBusinessDateTime(
  value: Date,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }
): Promise<string> {
  const { timezoneOffsetMinutes } = await getSystemConfig();
  // Shift by the offset and format as UTC, so the wall-clock time is the business one.
  return new Date(value.getTime() + timezoneOffsetMinutes * 60_000).toLocaleString("en-IN", { ...options, timeZone: "UTC" });
}
