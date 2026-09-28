import type { NextRequest } from "next/server";
import { z } from "zod";
import { ServiceType } from "@/generated/prisma/enums";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";

const serviceTypeValues = Object.values(ServiceType) as [string, ...string[]];

const querySchema = z
  .object({
    /** Nationality master id (P06). */
    nationalityId: z.string().min(1).max(40).optional(),
    /** Legacy: a nationality name, for callers that only have text. */
    nationality: z.string().trim().min(2).optional(),
    serviceType: z.enum(serviceTypeValues),
  })
  .refine((query) => query.nationalityId || query.nationality, { message: "Provide a nationality." });

/**
 * Public, unauthenticated — feeds a customer-facing document-checklist
 * preview (Visa_Change.md §11: "After nationality is available, show the
 * applicable Admin-configured document checklist. Do NOT show final
 * pricing at this stage."). Active-only, required documents first. No
 * sensitive fields on DocumentRequirement, so no session check needed.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Provide a valid nationality and serviceType.", parsed.error.flatten().fieldErrors);
  }

  // Matched on the nationality id; older rows that only carry the name are
  // still matched case-insensitively on it.
  const nationalityName = parsed.data.nationalityId
    ? (await db.nationality.findUnique({ where: { id: parsed.data.nationalityId }, select: { name: true } }))?.name
    : parsed.data.nationality;
  const nationalityMatch = [
    ...(parsed.data.nationalityId ? [{ nationalityId: parsed.data.nationalityId }] : []),
    ...(nationalityName ? [{ nationalityId: null, nationality: { equals: nationalityName, mode: "insensitive" as const } }] : []),
  ];
  if (nationalityMatch.length === 0) return jsonSuccess([]);

  const requirements = await db.documentRequirement.findMany({
    where: {
      OR: nationalityMatch,
      // zod's z.enum(serviceTypeValues) widens back to `string` since
      // serviceTypeValues is typed as a plain string tuple — safe to cast,
      // the enum() check already guarantees this is a real ServiceType value.
      serviceType: parsed.data.serviceType as ServiceType,
      active: true,
    },
    orderBy: [{ required: "desc" }, { documentName: "asc" }],
    select: { id: true, documentName: true, required: true },
  });

  return jsonSuccess(requirements);
}
