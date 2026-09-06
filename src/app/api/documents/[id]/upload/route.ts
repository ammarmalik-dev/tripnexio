import type { NextRequest } from "next/server";
import { uploadDocumentSchema } from "@/lib/validation/document-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Accepts an upload URL for an already-hosted file — no file storage is integrated here, this just attaches the URL. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = uploadDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.document.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Document not found.");

  const nextStatus = existing.status === "REQUIRED" || existing.status === "MISSING" ? "RECEIVED" : existing.status;

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.document.update({
      where: { id },
      data: { fileUrl: parsed.data.fileUrl, status: nextStatus },
    });
    await writeAudit(tx, {
      entityType: "Document",
      entityId: id,
      action: "UPLOAD",
      note: `File URL attached; status ${existing.status} -> ${nextStatus}`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
