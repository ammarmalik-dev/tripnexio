import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { writeAudit } from "@/lib/audit/log";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { leadServiceTypeSchema } from "@/lib/enquiries/schemas";
import { getInitialServiceStatusId } from "@/lib/service-status/engine";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Change a lead's service ("lead type"), e.g. an "Other" lead that is really
 * a New Visa request. Only before any quotation or booking exists — prices,
 * statuses and documents are service-specific after that. The lead moves to
 * the new service's first status; its reference stays the same (customers
 * may already have it). Needs a reason; audited.
 */
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
  const parsed = leadServiceTypeSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const reasonResult = readBodyReason(body);
  if (reasonResult.error) return reasonResult.error;
  const { serviceType } = parsed.data;

  const lead = await db.lead.findUnique({
    where: { id },
    select: { id: true, serviceType: true, reference: true, _count: { select: { quotations: true, bookings: true } } },
  });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(session, lead.serviceType) ?? assertServiceAccess(session, serviceType);
  if (scopeError) return scopeError;
  if (lead.serviceType === serviceType) return jsonError(400, "The lead already has this service.");
  if (lead._count.quotations > 0 || lead._count.bookings > 0) {
    return jsonError(409, "The service can only be changed before a quotation or booking is created for this lead.");
  }

  try {
    await db.$transaction(async (tx) => {
      const serviceStatusId = await getInitialServiceStatusId(tx, serviceType, "LEAD");
      await tx.lead.update({ where: { id }, data: { serviceType, serviceStatusId } });
      await writeAudit(tx, {
        entityType: "Lead",
        entityId: id,
        action: "SERVICE_TYPE_CHANGE",
        byUserId: session.id,
        note: withReason(
          `Service changed ${SERVICE_TYPE_LABELS[lead.serviceType]} → ${SERVICE_TYPE_LABELS[serviceType]} (by ${session.name})`,
          reasonResult.reason
        ),
      });
    });
    return jsonSuccess({ id, serviceType });
  } catch (error) {
    console.error("[api/leads/[id]/service-type] failed", error);
    return jsonError(500, "Couldn't change the service. Please try again.");
  }
}
