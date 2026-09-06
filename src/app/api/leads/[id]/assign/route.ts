import type { NextRequest } from "next/server";
import { assignLeadSchema } from "@/lib/validation/lead-assign-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { writeAudit } from "@/lib/audit/log";

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

  const parsed = assignLeadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return jsonError(404, "Lead not found.");

  let staffName: string | null = null;
  if (parsed.data.staffId) {
    const staff = await db.user.findUnique({ where: { id: parsed.data.staffId } });
    if (!staff || !staff.active) {
      return jsonError(400, "Select a valid, active staff member.", { staffId: ["This staff member isn't available."] });
    }
    staffName = staff.name;
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.lead.update({ where: { id }, data: { assignedStaffId: parsed.data.staffId } });
    await writeAudit(tx, {
      entityType: "Lead",
      entityId: id,
      action: "ASSIGN",
      byUserId: session.id,
      note: staffName ? `Assigned to ${staffName} (by ${session.name})` : `Unassigned (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
