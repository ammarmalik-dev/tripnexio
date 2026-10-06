import type { NextRequest } from "next/server";
import { createServiceTermsSchema } from "@/lib/validation/service-terms-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { ServiceType } from "@/generated/prisma/enums";

const include = { country: { select: { id: true, name: true } } } as const;

/** Every Terms version for one service (P09), newest first per country. */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const serviceType = new URL(request.url).searchParams.get("serviceType");
  if (!serviceType || !(serviceType in ServiceType)) return jsonError(400, "Provide a valid serviceType.");

  const terms = await db.serviceTerms.findMany({
    where: { serviceType: serviceType as ServiceType },
    include,
    orderBy: [{ countryId: "asc" }, { version: "desc" }],
  });
  return jsonSuccess(terms);
}

/** Publishes a new version for a service (and optional country); the version number is the next one for that pair. */
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
  const parsed = createServiceTermsSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  const countryId = parsed.data.countryId ?? null;
  // Domestic / International terms only exist for Special Fare; ignored for every other service.
  const flightScope = parsed.data.serviceType === "FLIGHT_SPECIAL_FARE" ? (parsed.data.flightScope ?? null) : null;
  if (countryId && !(await db.country.findUnique({ where: { id: countryId } }))) {
    return jsonError(400, "Select a valid country.", { countryId: ["Select a valid country."] });
  }

  const created = await db.$transaction(async (tx) => {
    const latest = await tx.serviceTerms.findFirst({
      where: { serviceType: parsed.data.serviceType, countryId, flightScope },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const row = await tx.serviceTerms.create({
      data: { serviceType: parsed.data.serviceType, countryId, flightScope, title: parsed.data.title, body: parsed.data.body, version: (latest?.version ?? 0) + 1 },
      include,
    });
    await writeAudit(tx, {
      entityType: "ServiceTerms",
      entityId: row.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Terms v${row.version} published for ${row.serviceType}${row.country ? ` / ${row.country.name}` : ""}${row.flightScope ? ` / ${row.flightScope.toLowerCase()} routes` : ""} (by ${session.name})`,
    });
    return row;
  });
  return jsonSuccess(created, 201);
}
