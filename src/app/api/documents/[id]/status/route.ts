import type { NextRequest } from "next/server";
import { updateDocumentStatusSchema } from "@/lib/validation/document-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateDocumentStatusSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.document.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Document not found.");

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.document.update({ where: { id }, data: { status: parsed.data.status } });
    await writeAudit(tx, {
      entityType: "Document",
      entityId: id,
      action: "STATUS_CHANGE",
      note: `${existing.status} -> ${parsed.data.status}`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
