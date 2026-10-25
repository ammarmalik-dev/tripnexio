import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { ADMIN_FULL_PERMISSION } from "@/lib/auth/permissions";
import { normaliseActions, summariseServicePermissions } from "@/lib/auth/service-actions";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { staffServicePermissionsSchema, type StaffServicePermissionsResponse } from "@/lib/validation/staff-service-permissions-schema";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function formatLimit(limit: number | null): string {
  return limit === null ? "no limit" : `₹${limit.toLocaleString("en-IN")}`;
}

async function loadResponse(userId: string): Promise<StaffServicePermissionsResponse | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      refundApprovalLimit: true,
      role: { select: { permissions: { select: { name: true } } } },
      servicePermissions: { select: { serviceType: true, actions: true }, orderBy: { serviceType: "asc" } },
    },
  });
  if (!user) return null;
  return {
    userId: user.id,
    grants: user.servicePermissions.map((grant) => ({ serviceType: grant.serviceType, actions: normaliseActions(grant.actions) })),
    refundApprovalLimit: user.refundApprovalLimit === null ? null : Number(user.refundApprovalLimit),
    isFullAdmin: user.role.permissions.some((permission) => permission.name === ADMIN_FULL_PERMISSION),
  };
}

/** Admin handover §1 / §17 — one staff member's service-wise permissions and refund approval limit. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("staff.manage");
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    const result = await loadResponse(id);
    if (!result) return jsonError(404, "Staff account not found.");
    return jsonSuccess(result);
  } catch (error) {
    console.error("[api/admin/users/service-permissions] GET", error);
    return jsonError(500, "Couldn't load this staff member's service permissions.");
  }
}

/**
 * Replaces the staff member's per-service rows (mode CUSTOM) or removes them all (mode ROLE), and sets the
 * refund approval limit. Requires a confirmation reason; nobody edits their own access; only a full admin
 * edits a full admin's.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("staff.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const reasonResult = readBodyReason(body);
  if (reasonResult.error) return reasonResult.error;
  const parsed = staffServicePermissionsSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  if (id === session.id) {
    return jsonError(403, "You can't change your own service permissions or refund limit. Ask another admin.");
  }

  try {
    const before = await loadResponse(id);
    if (!before) return jsonError(404, "Staff account not found.");
    if (before.isFullAdmin && !session.permissions.includes(ADMIN_FULL_PERMISSION)) {
      return jsonError(403, "Only a full admin can change a full admin's access.");
    }

    const grants =
      parsed.data.mode === "ROLE"
        ? []
        : parsed.data.grants.map((grant) => ({ serviceType: grant.serviceType, actions: normaliseActions(grant.actions) }));
    if (parsed.data.mode === "CUSTOM" && grants.length === 0) {
      return jsonError(400, "Tick at least one service, or choose “Use role permissions for every service”.", {
        grants: ["Select at least one service."],
      });
    }
    const limit = parsed.data.refundApprovalLimit;
    const labelFor = (serviceType: keyof typeof SERVICE_TYPE_LABELS) => SERVICE_TYPE_LABELS[serviceType];

    await db.$transaction(async (tx) => {
      await tx.staffServicePermission.deleteMany({ where: { userId: id } });
      if (grants.length > 0) {
        await tx.staffServicePermission.createMany({ data: grants.map((grant) => ({ userId: id, ...grant })) });
      }
      await tx.user.update({ where: { id }, data: { refundApprovalLimit: limit } });
      await writeAudit(tx, {
        entityType: "User",
        entityId: id,
        action: "SERVICE_PERMISSIONS_UPDATE",
        byUserId: session.id,
        note: withReason(
          `Service permissions: ${summariseServicePermissions(before.grants, labelFor)} -> ${summariseServicePermissions(grants, labelFor)}; refund approval limit: ${formatLimit(before.refundApprovalLimit)} -> ${formatLimit(limit)} (by ${session.name})`,
          reasonResult.reason
        ),
      });
    });

    const after = await loadResponse(id);
    return jsonSuccess(after);
  } catch (error) {
    console.error("[api/admin/users/service-permissions] PUT", error);
    return jsonError(500, "Couldn't save the service permissions. Please try again.");
  }
}
