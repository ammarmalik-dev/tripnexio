import type { NextRequest } from "next/server";
import { createDocumentRequirementSchema } from "@/lib/validation/document-requirement-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const requirements = await db.documentRequirement.findMany({ orderBy: [{ nationality: "asc" }, { serviceType: "asc" }] });
  return jsonSuccess(requirements);
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

  const parsed = createDocumentRequirementSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.documentRequirement.findUnique({
    where: {
      nationality_serviceType_documentName: {
        nationality: parsed.data.nationality,
        serviceType: parsed.data.serviceType,
        documentName: parsed.data.documentName,
      },
    },
  });
  if (existing) {
    return jsonError(400, "This document requirement already exists for this nationality and service.", {
      documentName: ["Already added — edit the existing row instead."],
    });
  }

  const requirement = await db.$transaction(async (tx) => {
    const created = await tx.documentRequirement.create({ data: parsed.data });
    await writeAudit(tx, {
      entityType: "DocumentRequirement",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Document requirement "${created.documentName}" added for ${created.nationality} / ${created.serviceType} (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(requirement, 201);
}
