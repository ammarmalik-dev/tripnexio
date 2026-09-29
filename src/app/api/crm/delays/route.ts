import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { isServiceScopeUnrestricted } from "@/lib/auth/service-scope";
import { getDelayAnalysis } from "@/lib/crm/delays";

/**
 * P21 item 9 — CRM.md §30 Delay Analysis. Gated by `bookings.view` (every
 * delay is a booking-level delay and every row links to a booking), and
 * scoped to the staff member's allowed services like every other list.
 * See src/lib/crm/delays.ts for the delay definition.
 */
export async function GET() {
  const auth = await requirePermission("bookings.view");
  if (auth.error) return auth.error;

  try {
    const scope = isServiceScopeUnrestricted(auth.session) ? undefined : auth.session.allowedServiceTypes;
    return jsonSuccess(await getDelayAnalysis(scope));
  } catch (error) {
    console.error("[api/crm/delays]", error);
    return jsonError(500, "Couldn't load the delay analysis.");
  }
}
