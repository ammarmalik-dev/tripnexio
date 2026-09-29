import { jsonSuccess } from "@/lib/api/respond";
import { getNewVisaTravelRules } from "@/lib/new-visa/travel-rules";

/** Public, unauthenticated — the New Visa minimum working days before travel (P10), so the form can grey out a processing type the server would refuse. */
export async function GET() {
  return jsonSuccess(await getNewVisaTravelRules());
}
