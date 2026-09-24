import type { NextRequest } from "next/server";
import { assignLeadSchema } from "@/lib/validation/lead-assign-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/permissions";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { getStaffIdsOnApprovedLeave, isRosterEligible } from "@/lib/staff/eligible-for-assignment";
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
//
// Step 50 (Internal Dashboard Merged §2) — a lead whose assignee has since
// gone inactive is treated as effectively unassigned: claiming it away
// from them only needs leads.edit, same as claiming a genuinely unassigned
// lead, since the client's own rule is "show the record as Unassigned"
// when that happens.
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

  const lead = await db.lead.findUnique({
    where: { id },
    include: { assignedStaff: { select: { name: true, active: true } } },
  });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(session, lead.serviceType);
  if (scopeError) return scopeError;

  const currentlyEffectivelyAssigned = lead.assignedStaffId !== null && lead.assignedStaff?.active === true;
  const isReassignment = currentlyEffectivelyAssigned && lead.assignedStaffId !== parsed.data.staffId;
  if (isReassignment && !hasPermission(session, "leads.reassign")) {
    return jsonError(403, "This lead is already assigned — only an Admin can reassign it.");
  }

  let staffName: string | null = null;
  if (parsed.data.staffId) {
    const staff = await db.user.findUnique({
      where: { id: parsed.data.staffId },
      include: { role: { include: { permissions: true } } },
    });
    if (!staff) {
      return jsonError(400, "Select a valid, active staff member.", { staffId: ["This staff member isn't available."] });
    }
    // Step 50 — never rely on the dropdown already having filtered to the
    // roster; enforce the exact same active + leads.edit + service-scope +
    // not-on-approved-leave rule server-side.
    if (!isRosterEligible(staff, lead.serviceType)) {
      return jsonError(400, "This staff member isn't available for this lead's service.", {
        staffId: ["This staff member isn't on the roster for this service."],
      });
    }
    const staffIdsOnLeave = await getStaffIdsOnApprovedLeave();
    if (staffIdsOnLeave.has(staff.id)) {
      return jsonError(400, "This staff member is currently on approved leave.", {
        staffId: ["This staff member is currently on approved leave."],
      });
    }
    staffName = staff.name;
  }

  // Step 50 — a richer note when overriding an inactive assignee, so the
  // record's history still shows who it was previously assigned to, per
  // the client's own "display the assigned agent's name wherever
  // applicable" wording.
  const wasAssignedToInactiveStaff = lead.assignedStaffId !== null && lead.assignedStaff?.active === false;

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.lead.update({ where: { id }, data: { assignedStaffId: parsed.data.staffId } });
    const note = staffName
      ? `Assigned to ${staffName} (by ${session.name})${wasAssignedToInactiveStaff ? ` — was previously assigned to ${lead.assignedStaff!.name}, now inactive` : ""}`
      : `Unassigned (by ${session.name})`;
    await writeAudit(tx, {
      entityType: "Lead",
      entityId: id,
      action: "ASSIGN",
      byUserId: session.id,
      note,
    });
    return result;
  });

  return jsonSuccess(updated);
}
