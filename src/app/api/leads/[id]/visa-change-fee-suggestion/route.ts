import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { computeVisaChangeFeeSuggestion } from "@/lib/quotations/visa-change-pricing";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Feeds the Visa Change quote builder's fee suggestion (Item 9,
 * client-message/PENDING_WORK_PROMPTS.md) — staff still enters/confirms
 * the final `feeAmount` on the quotation itself; this only computes what
 * the Admin-configured nationality/paxType rates suggest, from the lead's
 * own passengers (same `details.passengerIds` resolution every other
 * lead-scoped route already uses).
 */
export async function GET(request: Request, { params }: RouteParams) {
  const auth = await requirePermission("quotations.view");
  if (auth.error) return auth.error;

  const { id } = await params;

  const lead = await db.lead.findUnique({
    where: { id },
    include: { customer: { include: { passengers: true } } },
  });
  if (!lead) return jsonError(404, "Lead not found.");
  if (lead.serviceType !== "VISA_CHANGE") return jsonError(400, "This is only available for Visa Change leads.");

  const scopeError = assertServiceAccess(auth.session, lead.serviceType);
  if (scopeError) return scopeError;

  const details = (lead.details ?? {}) as Record<string, unknown>;
  const passengerIds = Array.isArray(details.passengerIds) ? (details.passengerIds as string[]) : [];
  const leadPassengers = lead.customer.passengers.filter((p) => passengerIds.includes(p.id));

  const suggestion = await computeVisaChangeFeeSuggestion(
    leadPassengers.map((p) => ({ id: p.id, fullName: p.fullName, nationality: p.nationality, paxType: p.paxType }))
  );

  return jsonSuccess(suggestion);
}
