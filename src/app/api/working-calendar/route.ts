import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { getWorkingCalendar, getWorkingCalendarForCountry } from "@/lib/calendar/get-working-calendar";

/**
 * Public, unauthenticated — the working calendar (weekend days, holiday
 * dates, business hours) the request forms use to preview date rules the
 * server enforces with the same calendar. No sensitive data.
 */
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  // Client doc 2026-10-15 — any destination by its Country master code (New Visa approval dates).
  const countryCode = params.get("countryCode");
  if (countryCode) {
    // Client doc 2026-10-27 (E1) — any Admin country code (not only 2–3 letters): a rejected code fell back to a
    // Monday–Friday calendar without the country's holidays, so the expected approval date counted them.
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(countryCode)) return jsonError(400, "countryCode must be a country code.");
    return jsonSuccess(await getWorkingCalendarForCountry(countryCode));
  }
  const country = params.get("country");
  if (country !== "INDIA" && country !== "UAE") return jsonError(400, "country must be INDIA or UAE.");
  return jsonSuccess(await getWorkingCalendar(country));
}
