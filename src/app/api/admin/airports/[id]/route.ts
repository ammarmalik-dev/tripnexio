import type { NextRequest } from "next/server";
import { updateAirportSchema } from "@/lib/validation/airport-schema";
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

  const parsed = updateAirportSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.airport.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Airport not found.");

  if (parsed.data.code && parsed.data.code !== existing.code) {
    const codeTaken = await db.airport.findUnique({ where: { code: parsed.data.code } });
    if (codeTaken) return jsonError(400, "An airport with this code already exists.", { code: ["This code is taken."] });
  }

  if (parsed.data.countryId) {
    const country = await db.country.findUnique({ where: { id: parsed.data.countryId } });
    if (!country) return jsonError(400, "Select a valid country.", { countryId: ["This country doesn't exist."] });
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.airport.update({ where: { id }, data: parsed.data });
    await writeAudit(tx, {
      entityType: "Airport",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Airport "${result.name}" updated (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
