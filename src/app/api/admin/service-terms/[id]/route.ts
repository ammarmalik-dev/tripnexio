import type { NextRequest } from "next/server";
import { updateServiceTermsSchema } from "@/lib/validation/service-terms-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Switch a Terms version on or off. The text itself never changes — publish a new version instead. */
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
  const parsed = updateServiceTermsSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.serviceTerms.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Terms not found.");

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.serviceTerms.update({ where: { id }, data: { active: parsed.data.active }, include: { country: { select: { id: true, name: true } } } });
    await writeAudit(tx, {
      entityType: "ServiceTerms",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Terms v${row.version} for ${row.serviceType} ${row.active ? "enabled" : "disabled"} (by ${session.name})`,
    });
    return row;
  });
  return jsonSuccess(updated);
}
