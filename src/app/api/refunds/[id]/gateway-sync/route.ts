import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { syncRefundWithGateway } from "@/lib/refunds/finalize-refund";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Client doc 2026-10-15 (I5) — "Check gateway": follow a refund sent to the gateway to its real result. */
export async function POST(_request: Request, { params }: RouteParams) {
  const auth = await requirePermission("refunds.view");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  try {
    const refund = await db.refund.findUnique({ where: { id }, select: { payment: { select: { booking: { select: { lead: { select: { serviceType: true } } } } } } } });
    if (!refund) return jsonError(404, "Refund not found.");
    const scopeError = assertServiceAccess(session, refund.payment.booking.lead.serviceType);
    if (scopeError) return scopeError;

    const result = await syncRefundWithGateway(id, { userId: session.id, label: `gateway check by ${session.name}` });
    if (!result.ok) return jsonError(409, result.error);
    return jsonSuccess(result);
  } catch (error) {
    console.error("[refunds] gateway sync failed", error);
    return jsonError(500, "Couldn't check the refund with the gateway.");
  }
}
