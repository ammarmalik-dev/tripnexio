import type { NextRequest } from "next/server";
import { jsonSuccess } from "@/lib/api/respond";
import { getNewVisaTravelRules } from "@/lib/new-visa/travel-rules";

/**
 * Public, unauthenticated — the New Visa minimum working days before travel
 * (P10) and processing days, so the form can grey out a processing type the
 * server would refuse and show the Expected Approval Date. `?country=AE`
 * applies that destination's own timeline (client testing 2026-10-09, B31).
 */
export async function GET(request: NextRequest) {
  // Client doc 2026-10-27 (E1) — any Admin country code (e.g. SAUDI_ARABIA): a code cut to 8 characters matched no
  // timeline, so the form lost the country's processing days (no Expected Approval Date) and minimum travel days.
  const country = request.nextUrl.searchParams.get("country")?.trim().slice(0, 20) || null;
  return jsonSuccess(await getNewVisaTravelRules(country));
}
