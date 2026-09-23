import type { NextRequest } from "next/server";
import { updateRefundStatusSchema } from "@/lib/validation/refund-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertValidRefundTransition } from "@/lib/refunds/transitions";
import { assertServiceAccess } from "@/lib/auth/service-scope";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// CRM.md §21: "CRM raises, Admin approves/rejects — CRM cannot approve its
// own refund." Every status transition here IS the approval action (the
// refund is always created PENDING by POST /api/payments/[id]/refunds,
// which stays gated by the more permissive refunds.edit) — so this route
// requires the dedicated refunds.approve permission (or admin.full), not
// refunds.edit.
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("refunds.approve");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateRefundStatusSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const refund = await db.refund.findUnique({
    where: { id },
    include: { payment: { include: { booking: { include: { lead: true } } } } },
  });
  if (!refund) return jsonError(404, "Refund not found.");
  const scopeError = assertServiceAccess(session, refund.payment.booking.lead.serviceType);
  if (scopeError) return scopeError;

  const transitionError = assertValidRefundTransition(refund.status, parsed.data.status);
  if (transitionError) return jsonError(409, transitionError);

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.refund.update({ where: { id }, data: { status: parsed.data.status } });
    await writeAudit(tx, {
      entityType: "Refund",
      entityId: id,
      action: "STATUS_CHANGE",
      byUserId: session.id,
      note: `${refund.status} -> ${parsed.data.status}${parsed.data.note ? `: ${parsed.data.note}` : ""} (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
