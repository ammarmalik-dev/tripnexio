import type { NextRequest } from "next/server";
import { updateOccupationSchema } from "@/lib/validation/occupation-schema";
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

  const parsed = updateOccupationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.occupation.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Occupation not found.");

  if (parsed.data.name && parsed.data.name.toLowerCase() !== existing.name.toLowerCase()) {
    const taken = await db.occupation.findFirst({ where: { name: { equals: parsed.data.name, mode: "insensitive" } } });
    if (taken) return jsonError(400, "This occupation already exists.", { name: ["Already in the list."] });
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.occupation.update({ where: { id }, data: parsed.data });
    await writeAudit(tx, {
      entityType: "Occupation",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Occupation "${row.name}" updated (by ${session.name})`,
    });
    return row;
  });

  return jsonSuccess(updated);
}

/** Existing requests keep the occupation as plain text, so removing an option never touches them. */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  const existing = await db.occupation.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Occupation not found.");

  await db.$transaction(async (tx) => {
    await tx.occupation.delete({ where: { id } });
    await writeAudit(tx, {
      entityType: "Occupation",
      entityId: id,
      action: "DELETE",
      byUserId: session.id,
      note: `Occupation "${existing.name}" removed (by ${session.name})`,
    });
  });

  return jsonSuccess({ id });
}
