import type { NextRequest } from "next/server";
import { updateDocumentRequirementSchema } from "@/lib/validation/document-requirement-schema";
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

  const parsed = updateDocumentRequirementSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.documentRequirement.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Document requirement not found.");

  const nextNationality = parsed.data.nationality ?? existing.nationality;
  const nextServiceType = parsed.data.serviceType ?? existing.serviceType;
  const nextDocumentName = parsed.data.documentName ?? existing.documentName;
  if (nextNationality !== existing.nationality || nextServiceType !== existing.serviceType || nextDocumentName !== existing.documentName) {
    const clash = await db.documentRequirement.findUnique({
      where: { nationality_serviceType_documentName: { nationality: nextNationality, serviceType: nextServiceType, documentName: nextDocumentName } },
    });
    if (clash && clash.id !== id) {
      return jsonError(400, "This document requirement already exists for this nationality and service.", {
        documentName: ["Already added — edit that row instead."],
      });
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.documentRequirement.update({ where: { id }, data: parsed.data });
    await writeAudit(tx, {
      entityType: "DocumentRequirement",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Document requirement "${result.documentName}" updated (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
