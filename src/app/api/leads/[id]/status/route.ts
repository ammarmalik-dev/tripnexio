import type { NextRequest } from "next/server";
import { serviceStatusChangeSchema } from "@/lib/validation/service-status-change-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { ADMIN_FULL_PERMISSION } from "@/lib/auth/permissions";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertServiceAction } from "@/lib/auth/service-actions";
import { dispatchStatusNotifications, getAllowedNextServiceStatuses, setServiceStatus } from "@/lib/service-status/engine";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** The lead's current per-service status and the statuses it may move to next (CRM.md §14). */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.view");
  if (auth.error) return auth.error;
  const { id } = await params;

  const lead = await db.lead.findUnique({ where: { id }, select: { serviceType: true } });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(auth.session, lead.serviceType);
  if (scopeError) return scopeError;

  const state = await getAllowedNextServiceStatuses("LEAD", id);
  // Client doc 2026-10-15 (I9) — an Admin may override the flow (the PATCH re-checks).
  return jsonSuccess(state ? { ...state, canOverride: auth.session.permissions.includes(ADMIN_FULL_PERMISSION) } : state);
}

/** Staff Change Status — only a transition configured for this service is accepted (P08). */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;
  // Client doc 2026-10-15 (C6) — only the record's own staff (or a manager / Admin) can act on it.
  const ownershipError = await assertOwnsEntity(auth.session, "lead", id);
  if (ownershipError) return ownershipError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = serviceStatusChangeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const lead = await db.lead.findUnique({ where: { id }, select: { serviceType: true } });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(auth.session, lead.serviceType);
  if (scopeError) return scopeError;
  const actionError = assertServiceAction(auth.session, lead.serviceType, "UPDATE_STATUS");
  if (actionError) return actionError;

  // Client doc 2026-10-15 (I9) — only an Admin may override, and always with a reason.
  const adminOverride = parsed.data.override === true;
  if (adminOverride && !session.permissions.includes(ADMIN_FULL_PERMISSION)) return jsonError(403, "Only an Admin can override the status flow.");
  if (adminOverride && (parsed.data.note?.length ?? 0) < 5) return jsonError(400, "Give a reason for the override (at least 5 characters).", { note: ["Reason required"] });

  const result = await db.$transaction((tx) =>
    setServiceStatus(tx, {
      scope: "LEAD",
      entityId: id,
      toStatusId: parsed.data.serviceStatusId,
      note: parsed.data.note,
      userId: session.id,
      actorLabel: `by ${session.name}`,
      adminOverride,
      inputs: parsed.data.inputs,
    })
  );
  if (!result.ok) return jsonError(result.httpStatus, result.error);
  await dispatchStatusNotifications([result.notification]);

  const updated = await db.lead.findUnique({ where: { id }, include: { serviceStatus: { select: { id: true, name: true } } } });
  return jsonSuccess(updated);
}
