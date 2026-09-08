import type { NextRequest } from "next/server";
import { updateCountrySchema } from "@/lib/validation/country-schema";
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

  const parsed = updateCountrySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.country.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Country not found.");

  if (parsed.data.code && parsed.data.code !== existing.code) {
    const codeTaken = await db.country.findUnique({ where: { code: parsed.data.code } });
    if (codeTaken) return jsonError(400, "A country with this code already exists.", { code: ["This code is taken."] });
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.country.update({ where: { id }, data: parsed.data });
    await writeAudit(tx, {
      entityType: "Country",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Country "${result.name}" updated (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
