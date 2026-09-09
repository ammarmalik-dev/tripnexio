import type { NextRequest } from "next/server";
import { updateLeadTemperatureSchema } from "@/lib/validation/lead-temperature-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { writeAudit } from "@/lib/audit/log";
import { LEAD_TEMPERATURE_LABELS } from "@/lib/crm/labels";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * CRM.md §5 (Step 12): temperature has no lifecycle/transition rules like
 * LeadStatus — staff can set it to any value, or clear it back to unset, at
 * any time.
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

  const parsed = updateLeadTemperatureSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return jsonError(404, "Lead not found.");

  const nextLabel = parsed.data.temperature ? LEAD_TEMPERATURE_LABELS[parsed.data.temperature] : "Not set";
  const previousLabel = lead.temperature ? LEAD_TEMPERATURE_LABELS[lead.temperature] : "Not set";

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.lead.update({ where: { id }, data: { temperature: parsed.data.temperature } });
    await writeAudit(tx, {
      entityType: "Lead",
      entityId: id,
      action: "TEMPERATURE_CHANGE",
      byUserId: session.id,
      note: `${previousLabel} -> ${nextLabel} (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
