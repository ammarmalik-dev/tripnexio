import type { NextRequest } from "next/server";
import { serviceStatusChangeSchema } from "@/lib/validation/service-status-change-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { dispatchStatusNotifications, getAllowedNextServiceStatuses, setServiceStatus } from "@/lib/service-status/engine";

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

  return jsonSuccess(await getAllowedNextServiceStatuses("LEAD", id));
}

/** Staff Change Status — only a transition configured for this service is accepted (P08). */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

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

  const result = await db.$transaction((tx) =>
    setServiceStatus(tx, {
      scope: "LEAD",
      entityId: id,
      toStatusId: parsed.data.serviceStatusId,
      note: parsed.data.note,
      userId: session.id,
      actorLabel: `by ${session.name}`,
    })
  );
  if (!result.ok) return jsonError(result.httpStatus, result.error);
  await dispatchStatusNotifications([result.notification]);

  const updated = await db.lead.findUnique({ where: { id }, include: { serviceStatus: { select: { id: true, name: true } } } });
  return jsonSuccess(updated);
}
