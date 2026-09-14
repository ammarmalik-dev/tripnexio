import type { NextRequest } from "next/server";
import { createServiceStatusSchema } from "@/lib/validation/service-status-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { ServiceType, StatusScope } from "../../../../generated/prisma/enums";

/**
 * Step 19 Unit 1 (audit §3.9/§7.3) — Admin CRUD for the per-service status
 * catalog. `?serviceType=&scope=` are both required — this screen is
 * always scoped to one service's own list at a time (CRM.md §14: "the
 * Change Status modal reads the configured status list for the booking's
 * Service/Sub-service"), never a flat cross-service table.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const serviceType = searchParams.get("serviceType");
  const scope = searchParams.get("scope");

  if (!serviceType || !Object.values(ServiceType).includes(serviceType as ServiceType)) {
    return jsonError(400, "A valid serviceType is required.");
  }
  if (!scope || !Object.values(StatusScope).includes(scope as StatusScope)) {
    return jsonError(400, "A valid scope is required.");
  }

  const statuses = await db.serviceStatus.findMany({
    where: { serviceType: serviceType as ServiceType, scope: scope as StatusScope },
    include: { fromTransitions: { select: { id: true, toStatusId: true } } },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

  return jsonSuccess(
    statuses.map(({ fromTransitions, ...status }) => ({
      ...status,
      transitions: fromTransitions,
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createServiceStatusSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.serviceStatus.findUnique({
    where: { serviceType_scope_name: { serviceType: parsed.data.serviceType, scope: parsed.data.scope, name: parsed.data.name } },
  });
  if (existing) {
    return jsonError(400, "A status with this name already exists for this service.", { name: ["This name is taken."] });
  }

  const status = await db.$transaction(async (tx) => {
    const created = await tx.serviceStatus.create({ data: parsed.data });
    await writeAudit(tx, {
      entityType: "ServiceStatus",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Status "${created.name}" created for ${created.serviceType}/${created.scope} (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess({ ...status, transitions: [] }, 201);
}
