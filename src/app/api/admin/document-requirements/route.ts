import type { NextRequest } from "next/server";
import { createDocumentRequirementSchema } from "@/lib/validation/document-requirement-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const requirements = await db.documentRequirement.findMany({
    include: { country: { select: { id: true, name: true, code: true } } },
    orderBy: [{ serviceType: "asc" }, { country: { name: "asc" } }, { nationality: "asc" }],
  });
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

  if (parsed.data.countryId) {
    const country = await db.country.findUnique({ where: { id: parsed.data.countryId } });
    if (!country) return jsonError(400, "Country not found.", { countryId: ["Select a valid country."] });
  }

  // No DB-level uniqueness on this combination (see the model's own doc
  // comment — nullable-column uniqueness semantics get messy in Postgres),
  // so an exact-match duplicate is checked here instead — same pattern
  // PricingRule's routes already use (Step 40).
  const existing = await db.documentRequirement.findFirst({
    where: {
      serviceType: parsed.data.serviceType,
      countryId: parsed.data.countryId ?? null,
      nationality: parsed.data.nationality ?? null,
      paxType: parsed.data.paxType ?? null,
      documentName: parsed.data.documentName,
    },
  });
  if (existing) {
    return jsonError(400, "A document requirement already exists for this exact combination.", {
      documentName: ["Already added — edit the existing row instead."],
    });
  }

  const requirement = await db.$transaction(async (tx) => {
    const created = await tx.documentRequirement.create({
      data: parsed.data,
      include: { country: { select: { id: true, name: true, code: true } } },
    });
    await writeAudit(tx, {
      entityType: "DocumentRequirement",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Document requirement "${created.documentName}" added for ${created.serviceType}${created.country ? ` / ${created.country.name}` : ""}${created.nationality ? ` / ${created.nationality}` : ""}${created.paxType ? ` / ${created.paxType}` : ""} (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(requirement, 201);
}
