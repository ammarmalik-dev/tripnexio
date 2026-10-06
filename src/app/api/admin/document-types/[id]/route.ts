import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { updateDocumentTypeSchema } from "@/lib/validation/document-type-schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Edits a Document Master entry. A rename is carried to every requirement
 * that uses it (their documentName copy), in the same transaction, so lists,
 * checklists and the website stay consistent. Disabling hides it from new
 * selections; existing requirements keep working.
 */
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
  const parsed = updateDocumentTypeSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  const existing = await db.documentType.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Document not found.");
  const renamed = parsed.data.name !== undefined && parsed.data.name !== existing.name;
  if (renamed) {
    const duplicate = await db.documentType.findFirst({
      where: { id: { not: id }, name: { equals: parsed.data.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) return jsonError(400, "Another document already has this name.", { name: ["Already in the list."] });
  }

  const updated = await db.$transaction(async (tx) => {
    const type = await tx.documentType.update({
      where: { id },
      data: { ...parsed.data, ...(parsed.data.description !== undefined ? { description: parsed.data.description || null } : {}) },
      include: { _count: { select: { requirements: true } } },
    });
    if (renamed) await tx.documentRequirement.updateMany({ where: { documentTypeId: id }, data: { documentName: type.name } });
    const changes = [
      renamed ? `renamed "${existing.name}" -> "${type.name}" (${type._count.requirements} requirement(s) updated)` : null,
      parsed.data.defaultMandatory !== undefined && parsed.data.defaultMandatory !== existing.defaultMandatory
        ? `default ${type.defaultMandatory ? "mandatory" : "optional"}`
        : null,
      parsed.data.active !== undefined && parsed.data.active !== existing.active ? (type.active ? "enabled" : "disabled") : null,
    ].filter(Boolean);
    await writeAudit(tx, {
      entityType: "DocumentType",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Document Master entry "${type.name}" updated${changes.length ? `: ${changes.join(", ")}` : ""} (by ${session.name})`,
    });
    return type;
  });

  const { _count, ...type } = updated;
  return jsonSuccess({ ...type, usedIn: _count.requirements });
}
