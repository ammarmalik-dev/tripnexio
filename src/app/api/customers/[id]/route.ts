import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { loadCustomer360 } from "@/lib/customers/customer-360";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * CRM.md §23 — Customer 360 (profile, leads, bookings, passengers,
 * quotations, payments, refunds, documents, communications, follow-up
 * tasks, timeline). Gated by `leads.view`; each operational section is
 * additionally gated by its own view permission inside loadCustomer360
 * (null when the role lacks it). Service-scoped staff get 403 for a
 * customer with no lead in their allowed services.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.view");
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const result = await loadCustomer360(auth.session, id);
    if (result.kind === "not_found") return jsonError(404, "Customer not found.");
    if (result.kind === "forbidden") return jsonError(403, "You don't have access to this customer's services.");
    return jsonSuccess(result.data);
  } catch (error) {
    console.error("GET /api/customers/[id] failed", error);
    return jsonError(500, "Couldn't load this customer. Please try again.");
  }
}
