import type { NextRequest } from "next/server";
import { createAirportSchema } from "@/lib/validation/airport-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const airports = await db.airport.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: { countryRef: { select: { id: true, name: true, code: true } } },
  });
  return jsonSuccess(airports);
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

  const parsed = createAirportSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.airport.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return jsonError(400, "An airport with this code already exists.", { code: ["This code is taken."] });
  }

  const country = await db.country.findUnique({ where: { id: parsed.data.countryId } });
  if (!country) {
    return jsonError(400, "Select a valid country.", { countryId: ["This country doesn't exist."] });
  }

  const airport = await db.$transaction(async (tx) => {
    const created = await tx.airport.create({ data: parsed.data });
    await writeAudit(tx, {
      entityType: "Airport",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Airport "${created.name}" (${created.code}) created (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(airport, 201);
}
