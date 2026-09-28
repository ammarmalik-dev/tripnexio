import type { NextRequest } from "next/server";
import { jsonSuccess } from "@/lib/api/respond";
import { getActiveVisaTypes } from "@/lib/visa-types/active-visa-types";

/**
 * Public, unauthenticated — the New Visa form's "Visa Type" options for a
 * destination country (`?country=<Country.code>`): active types for that
 * country plus the ones offered for every country. Admin-managed.
 */
export async function GET(request: NextRequest) {
  const country = new URL(request.url).searchParams.get("country")?.trim() ?? "";
  const visaTypes = await getActiveVisaTypes(country);
  return jsonSuccess(visaTypes.map((visaType) => ({ id: visaType.id, name: visaType.name })));
}
