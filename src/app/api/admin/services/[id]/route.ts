import type { NextRequest } from "next/server";
import { updateServiceSchema } from "@/lib/validation/service-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateServiceSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.service.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Service not found.");

  if (parsed.data.code && parsed.data.code !== existing.code) {
    const codeTaken = await db.service.findUnique({ where: { code: parsed.data.code } });
    if (codeTaken) return jsonError(400, "A service with this code already exists.", { code: ["This service already has a metadata row."] });
  }
  if (parsed.data.referenceCode && parsed.data.referenceCode !== existing.referenceCode) {
    const referenceTaken = await db.service.findUnique({ where: { referenceCode: parsed.data.referenceCode } });
    if (referenceTaken) {
      return jsonError(400, "Another service already uses this reference code.", { referenceCode: ["Already used by another service."] });
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.service.update({ where: { id }, data: parsed.data });
    await writeAudit(tx, {
      entityType: "Service",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Service "${result.name}" updated${
        parsed.data.referenceCode && parsed.data.referenceCode !== existing.referenceCode
          ? ` — reference code ${existing.referenceCode} -> ${result.referenceCode} (new references only)`
          : ""
      } (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
