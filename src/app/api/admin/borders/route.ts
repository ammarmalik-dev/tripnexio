import type { NextRequest } from "next/server";
import { createBorderSchema } from "@/lib/validation/border-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const borders = await db.border.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }] });
  return jsonSuccess(borders);
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

  const parsed = createBorderSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const border = await db.$transaction(async (tx) => {
    const created = await tx.border.create({ data: parsed.data });
    await writeAudit(tx, {
      entityType: "Border",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Border crossing "${created.name}" created (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(border, 201);
}
