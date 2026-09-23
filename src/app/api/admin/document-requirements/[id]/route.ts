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

  if (parsed.data.countryId) {
    const country = await db.country.findUnique({ where: { id: parsed.data.countryId } });
    if (!country) return jsonError(400, "Country not found.", { countryId: ["Select a valid country."] });
  }

  const nextServiceType = parsed.data.serviceType ?? existing.serviceType;
  const nextCountryId = parsed.data.countryId !== undefined ? parsed.data.countryId : existing.countryId;
  const nextNationality = parsed.data.nationality !== undefined ? parsed.data.nationality : existing.nationality;
  const nextPaxType = parsed.data.paxType !== undefined ? parsed.data.paxType : existing.paxType;
  const nextDocumentName = parsed.data.documentName ?? existing.documentName;

  const identityChanged =
    nextServiceType !== existing.serviceType ||
    nextCountryId !== existing.countryId ||
    nextNationality !== existing.nationality ||
    nextPaxType !== existing.paxType ||
    nextDocumentName !== existing.documentName;

  if (identityChanged) {
    const clash = await db.documentRequirement.findFirst({
      where: {
        serviceType: nextServiceType,
        countryId: nextCountryId,
        nationality: nextNationality,
        paxType: nextPaxType,
        documentName: nextDocumentName,
      },
    });
    if (clash && clash.id !== id) {
      return jsonError(400, "A document requirement already exists for this exact combination.", {
        documentName: ["Already added — edit that row instead."],
      });
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.documentRequirement.update({
      where: { id },
      data: parsed.data,
      include: { country: { select: { id: true, name: true, code: true } } },
    });
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
