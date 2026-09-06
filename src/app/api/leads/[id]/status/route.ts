import type { NextRequest } from "next/server";
import { updateLeadStatusSchema } from "@/lib/validation/lead-status-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { writeAudit } from "@/lib/audit/log";
import { assertValidLeadTransition } from "@/lib/leads/transitions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

  const parsed = updateLeadStatusSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return jsonError(404, "Lead not found.");

  const transitionError = assertValidLeadTransition(lead.status, parsed.data.status);
  if (transitionError) return jsonError(409, transitionError);

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.lead.update({ where: { id }, data: { status: parsed.data.status } });
    await writeAudit(tx, {
      entityType: "Lead",
      entityId: id,
      action: "STATUS_CHANGE",
      byUserId: session.id,
      note: `${lead.status} -> ${parsed.data.status}${parsed.data.note ? `: ${parsed.data.note}` : ""} (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
