import type { NextRequest } from "next/server";
import { updateNationalitySchema } from "@/lib/validation/nationality-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const include = { country: { select: { id: true, name: true, code: true, flagOverride: true } } } as const;

/**
 * Edit or enable/disable only — no delete: passengers, pricing rules and
 * document requirements reference nationalities by id, so a retired one is
 * hidden (active: false) rather than removed.
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

  const parsed = updateNationalitySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.nationality.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Nationality not found.");

  if (parsed.data.countryId && !(await db.country.findUnique({ where: { id: parsed.data.countryId } }))) {
    return jsonError(400, "Select a valid country.", { countryId: ["Select a valid country."] });
  }
  if (parsed.data.name && parsed.data.name.toLowerCase() !== existing.name.toLowerCase()) {
    const taken = await db.nationality.findFirst({ where: { name: { equals: parsed.data.name, mode: "insensitive" } } });
    if (taken) return jsonError(400, "This nationality already exists.", { name: ["Already in the list."] });
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.nationality.update({ where: { id }, data: parsed.data, include });
    await writeAudit(tx, {
      entityType: "Nationality",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Nationality "${row.name}" updated (by ${session.name})`,
    });
    return row;
  });

  return jsonSuccess(updated);
}
