import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { describeError } from "@/lib/api/describe-error";
import {
  KNOWLEDGE_DOCUMENT_MAX_BYTES,
  KNOWLEDGE_DOCUMENT_TYPES,
  saveKnowledgeFile,
  sniffKnowledgeDocument,
} from "@/lib/knowledge/document-files";
import type { KnowledgeArticleCategory } from "@/generated/prisma/enums";

const CATEGORIES: KnowledgeArticleCategory[] = ["SOP", "STAFF_FAQ", "TRAINING"];

/** Client doc 16 Nov (L4) — the Knowledge Centre's uploaded documents (newest first). */
export async function GET() {
  const auth = await requirePermission("knowledge.view");
  if (auth.error) return auth.error;
  try {
    const rows = await db.knowledgeDocument.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, title: true, fileName: true, mimeType: true, sizeBytes: true, category: true, createdAt: true, uploadedBy: { select: { name: true } } },
    });
    return jsonSuccess(rows.map(({ uploadedBy, ...row }) => ({ ...row, uploadedBy: uploadedBy?.name ?? null })));
  } catch (error) {
    console.error("[api/knowledge-documents] list failed", describeError(error));
    return jsonError(500, "Couldn't load the documents.");
  }
}

/**
 * One file per request (multipart `file`, optional `title` / `category`), so the bulk-upload screen can show each
 * file's own progress and result. PDF, DOC or DOCX only — checked from the bytes — up to 10MB.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermission("knowledge.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "Send the file as a form upload.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError(400, "Choose a file.", { file: ["Choose a file."] });
  if (file.size === 0) return jsonError(400, "That file is empty.", { file: ["That file is empty."] });
  if (file.size > KNOWLEDGE_DOCUMENT_MAX_BYTES) return jsonError(413, "That file is too large (10MB max).", { file: ["10MB max."] });

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = sniffKnowledgeDocument(buffer);
  if (!mimeType) return jsonError(415, "Only PDF, DOC or DOCX files can be uploaded.", { file: ["Use PDF, DOC or DOCX."] });

  const fileName = file.name.trim().slice(0, 200) || `document.${KNOWLEDGE_DOCUMENT_TYPES[mimeType].extension}`;
  const rawTitle = form.get("title");
  const title = (typeof rawTitle === "string" && rawTitle.trim() ? rawTitle.trim() : fileName.replace(/\.[^.]+$/, "")).slice(0, 200);
  const rawCategory = form.get("category");
  const category = typeof rawCategory === "string" && (CATEGORIES as string[]).includes(rawCategory) ? (rawCategory as KnowledgeArticleCategory) : null;

  try {
    const storageKey = await saveKnowledgeFile(buffer, mimeType);
    const row = await db.$transaction(async (tx) => {
      const created = await tx.knowledgeDocument.create({
        data: { title, fileName, mimeType, sizeBytes: buffer.length, storageKey, category, uploadedById: session.id },
        select: { id: true, title: true, fileName: true, mimeType: true, sizeBytes: true, category: true, createdAt: true },
      });
      await writeAudit(tx, {
        entityType: "KnowledgeDocument",
        entityId: created.id,
        action: "CREATE",
        byUserId: session.id,
        note: `Knowledge Centre document "${title}" uploaded (${KNOWLEDGE_DOCUMENT_TYPES[mimeType].label}, ${Math.ceil(buffer.length / 1024)} KB) (by ${session.name})`,
      });
      return created;
    });
    return jsonSuccess({ ...row, uploadedBy: session.name }, 201);
  } catch (error) {
    console.error("[api/knowledge-documents] upload failed", describeError(error));
    return jsonError(500, "Couldn't save the file. Please try again.");
  }
}
