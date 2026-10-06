import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { createDocumentTypeSchema } from "@/lib/validation/document-type-schema";

/** Client corrections 2026-10-05 — Admin → Document Master: every document definition with how many requirements use it. */
export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const types = await db.documentType.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { requirements: true } } },
  });
  return jsonSuccess(types.map(({ _count, ...type }) => ({ ...type, usedIn: _count.requirements })));
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
  const parsed = createDocumentTypeSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  const duplicate = await db.documentType.findFirst({ where: { name: { equals: parsed.data.name, mode: "insensitive" } }, select: { id: true } });
  if (duplicate) return jsonError(400, "This document already exists in the Document Master.", { name: ["Already in the list."] });

  const created = await db.$transaction(async (tx) => {
    const type = await tx.documentType.create({ data: { ...parsed.data, description: parsed.data.description || null } });
    await writeAudit(tx, {
      entityType: "DocumentType",
      entityId: type.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Document Master entry "${type.name}" added (${type.defaultMandatory ? "mandatory" : "optional"} by default) (by ${session.name})`,
    });
    return type;
  });
  return jsonSuccess({ ...created, usedIn: 0 }, 201);
}
