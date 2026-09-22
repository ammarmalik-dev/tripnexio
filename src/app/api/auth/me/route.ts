import { jsonSuccess } from "@/lib/api/respond";
import { getCustomerSession } from "@/lib/auth/get-customer-session";

/** Public — returns the signed-in customer's own basic info, or null. Used by client components (e.g. the navbar) to show signed-in state. */
export async function GET() {
  const session = await getCustomerSession();
  return jsonSuccess(session ? { id: session.id, name: session.name, email: session.email } : null);
}
