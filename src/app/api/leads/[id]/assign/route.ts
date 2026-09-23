import type { NextRequest } from "next/server";
import { assignLeadSchema } from "@/lib/validation/lead-assign-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/permissions";
import { assertServiceAccess, hasServiceAccess } from "@/lib/auth/service-scope";
import { writeAudit } from "@/lib/audit/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// CRM.md §34 / ADMIN.md §12: "normal CRM staff CANNOT assign/reassign...
// Admin CAN." leads.edit only covers claiming/assigning a currently-
// UNASSIGNED lead. Moving a lead that's already assigned to someone else
// (including unassigning it) is a reassignment and requires the dedicated
// leads.reassign permission (or admin.full) — checked further down, once
// the lead's current assignment state is known.
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
  const scopeError = assertServiceAccess(session, lead.serviceType);
  if (scopeError) return scopeError;

  const isReassignment = lead.assignedStaffId !== null && lead.assignedStaffId !== parsed.data.staffId;
  if (isReassignment && !hasPermission(session, "leads.reassign")) {
    return jsonError(403, "This lead is already assigned — only an Admin can reassign it.");
  }

  let staffName: string | null = null;
  if (parsed.data.staffId) {
    const staff = await db.user.findUnique({
      where: { id: parsed.data.staffId },
      include: { role: { include: { permissions: true } } },
    });
    if (!staff || !staff.active) {
      return jsonError(400, "Select a valid, active staff member.", { staffId: ["This staff member isn't available."] });
    }
    // Don't assign a lead to someone scoped out of its service — mirrors
    // the requesting staff member's own check above, applied to the target.
    if (!hasServiceAccess({ permissions: staff.role.permissions.map((p) => p.name), allowedServiceTypes: staff.allowedServiceTypes }, lead.serviceType)) {
      return jsonError(400, "This staff member isn't scoped for this lead's service.", {
        staffId: ["This staff member doesn't have access to this service."],
      });
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
