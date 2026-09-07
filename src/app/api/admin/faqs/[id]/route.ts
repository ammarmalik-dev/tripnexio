import type { NextRequest } from "next/server";
import { updateFaqSchema } from "@/lib/validation/faq-schema";
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

  const parsed = updateFaqSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.faq.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "FAQ not found.");

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.faq.update({ where: { id }, data: parsed.data });
    await writeAudit(tx, {
      entityType: "Faq",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `FAQ "${result.question}" updated (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  const existing = await db.faq.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "FAQ not found.");

  await db.$transaction(async (tx) => {
    await tx.faq.delete({ where: { id } });
    await writeAudit(tx, {
      entityType: "Faq",
      entityId: id,
      action: "DELETE",
      byUserId: session.id,
      note: `FAQ "${existing.question}" deleted (by ${session.name})`,
    });
  });

  return jsonSuccess({ id });
}
