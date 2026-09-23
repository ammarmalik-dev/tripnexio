import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { ServiceType, type ServiceType as ServiceTypeT } from "@/generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeT, ...ServiceTypeT[]];

/**
 * Step 41 (Admin FINAL handover §5 — "Allow one-click/bulk application of
 * the same checklist to multiple services where applicable"). Same shape
 * as Bulk Reassignment (Step 26 Unit 4): GET previews the source
 * "checklist" (every requirement row matching one exact
 * service/country/nationality/paxType combination), POST copies it onto
 * one or more target services in one transaction.
 *
 * A target service that already has an identical-key row (same country/
 * nationality/paxType/documentName) is skipped for that one document —
 * never overwritten — so re-running this against a partially-applied
 * target is safe and idempotent rather than erroring or duplicating.
 */
const bulkApplySchema = z.object({
  sourceServiceType: z.enum(serviceTypeValues, { error: "Select a source service" }),
  sourceCountryId: z.string().min(1).optional(),
  sourceNationality: z.string().trim().min(1).optional(),
  sourcePaxType: z.enum(["ADULT", "CHILD", "INFANT"]).optional(),
  targetServiceTypes: z.array(z.enum(serviceTypeValues)).min(1, "Select at least one target service"),
});

function sourceWhere(params: URLSearchParams) {
  const serviceType = params.get("serviceType");
  if (!serviceType || !serviceTypeValues.includes(serviceType as ServiceTypeT)) return null;
  return {
    serviceType: serviceType as ServiceTypeT,
    countryId: params.get("countryId") || null,
    nationality: params.get("nationality") || null,
    paxType: (params.get("paxType") as "ADULT" | "CHILD" | "INFANT" | null) || null,
  };
}

/** Preview: every requirement row matching one exact source combination — what a POST would copy. */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const where = sourceWhere(new URL(request.url).searchParams);
  if (!where) return jsonError(400, "Provide a valid serviceType query parameter.");

  const rows = await db.documentRequirement.findMany({
    where,
    include: { country: { select: { id: true, name: true, code: true } } },
    orderBy: { documentName: "asc" },
  });
  return jsonSuccess(rows);
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

  const parsed = bulkApplySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const { sourceServiceType, sourceCountryId, sourceNationality, sourcePaxType, targetServiceTypes } = parsed.data;

  if (sourceCountryId) {
    const country = await db.country.findUnique({ where: { id: sourceCountryId } });
    if (!country) return jsonError(400, "Country not found.", { sourceCountryId: ["Select a valid country."] });
  }

  const sourceRows = await db.documentRequirement.findMany({
    where: {
      serviceType: sourceServiceType,
      countryId: sourceCountryId ?? null,
      nationality: sourceNationality ?? null,
      paxType: sourcePaxType ?? null,
    },
  });
  if (sourceRows.length === 0) {
    return jsonError(400, "No document requirements match this source combination — nothing to apply.");
  }

  const targets = targetServiceTypes.filter((service) => service !== sourceServiceType);
  if (targets.length === 0) {
    return jsonError(400, "Select at least one target service other than the source service.", {
      targetServiceTypes: ["Choose a different service from the source."],
    });
  }

  const copiedByService: Record<string, number> = {};

  await db.$transaction(async (tx) => {
    for (const targetService of targets) {
      const existingTargetRows = await tx.documentRequirement.findMany({
        where: { serviceType: targetService, countryId: sourceCountryId ?? null, nationality: sourceNationality ?? null, paxType: sourcePaxType ?? null },
        select: { documentName: true },
      });
      const existingNames = new Set(existingTargetRows.map((row) => row.documentName));
      const toCopy = sourceRows.filter((row) => !existingNames.has(row.documentName));

      if (toCopy.length === 0) {
        copiedByService[targetService] = 0;
        continue;
      }

      await tx.documentRequirement.createMany({
        data: toCopy.map((row) => ({
          serviceType: targetService,
          countryId: row.countryId,
          nationality: row.nationality,
          paxType: row.paxType,
          documentName: row.documentName,
          required: row.required,
          active: row.active,
        })),
      });
      copiedByService[targetService] = toCopy.length;

      await writeAudit(tx, {
        entityType: "DocumentRequirement",
        entityId: targetService,
        action: "BULK_APPLY",
        byUserId: session.id,
        note: `Copied ${toCopy.length} document requirement(s) from ${sourceServiceType}${sourceCountryId ? ` (country ${sourceCountryId})` : ""}${sourceNationality ? ` / ${sourceNationality}` : ""}${sourcePaxType ? ` / ${sourcePaxType}` : ""} onto ${targetService} (by ${session.name})`,
      });
    }
  });

  return jsonSuccess({ copiedByService });
}
