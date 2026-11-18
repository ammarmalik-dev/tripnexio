import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { readDeleteReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { describeError } from "@/lib/api/describe-error";
import { deleteKnowledgeFile } from "@/lib/knowledge/document-files";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Client doc 16 Nov (L4) — delete an uploaded Knowledge Centre document (reason required, audited). */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("knowledge.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  const reasonResult = await readDeleteReason(request);
  if (reasonResult.error) return reasonResult.error;
  const { reason } = reasonResult;

  try {
    const existing = await db.knowledgeDocument.findUnique({ where: { id }, select: { id: true, title: true, storageKey: true } });
    if (!existing) return jsonError(404, "Document not found.");
    await db.$transaction(async (tx) => {
      await tx.knowledgeDocument.delete({ where: { id } });
      await writeAudit(tx, {
        entityType: "KnowledgeDocument",
        entityId: id,
        action: "DELETE",
        byUserId: session.id,
        note: withReason(`Knowledge Centre document "${existing.title}" deleted (by ${session.name})`, reason),
      });
    });
    // The bytes go after the row is gone, so a failed file cleanup never leaves a row pointing at nothing.
    await deleteKnowledgeFile(existing.storageKey);
    return jsonSuccess({ id });
  } catch (error) {
    console.error("[api/knowledge-documents] delete failed", describeError(error));
    return jsonError(500, "Couldn't delete the document.");
  }
}
