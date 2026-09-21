import type { NextRequest } from "next/server";
import { createOccupationSchema } from "@/lib/validation/occupation-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const occupations = await db.occupation.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }] });
  return jsonSuccess(occupations);
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

  const parsed = createOccupationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.occupation.findFirst({ where: { name: { equals: parsed.data.name, mode: "insensitive" } } });
  if (existing) return jsonError(400, "This occupation already exists.", { name: ["Already in the list."] });

  const created = await db.$transaction(async (tx) => {
    const row = await tx.occupation.create({ data: parsed.data });
    await writeAudit(tx, {
      entityType: "Occupation",
      entityId: row.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Occupation "${row.name}" added (by ${session.name})`,
    });
    return row;
  });

  return jsonSuccess(created, 201);
}
