import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { getWorkingCalendar } from "@/lib/calendar/get-working-calendar";

/**
 * Public, unauthenticated — the working calendar (weekend days, holiday
 * dates, business hours) the request forms use to preview date rules the
 * server enforces with the same calendar. No sensitive data.
 */
export async function GET(request: NextRequest) {
  const country = new URL(request.url).searchParams.get("country");
  if (country !== "INDIA" && country !== "UAE") return jsonError(400, "country must be INDIA or UAE.");
  return jsonSuccess(await getWorkingCalendar(country));
}
