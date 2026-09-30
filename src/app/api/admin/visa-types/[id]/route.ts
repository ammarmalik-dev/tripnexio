import type { NextRequest } from "next/server";
import { updateVisaTypeSchema } from "@/lib/validation/visa-type-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { readDeleteReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const include = { country: { select: { id: true, name: true } } } as const;

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

  const parsed = updateVisaTypeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.visaType.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Visa type not found.");

  const nextCountryId = parsed.data.countryId !== undefined ? parsed.data.countryId : existing.countryId;
  const nextName = parsed.data.name ?? existing.name;
  if (nextCountryId && nextCountryId !== existing.countryId && !(await db.country.findUnique({ where: { id: nextCountryId } }))) {
    return jsonError(400, "Select a valid country.", { countryId: ["Select a valid country."] });
  }
  if (nextName.toLowerCase() !== existing.name.toLowerCase() || nextCountryId !== existing.countryId) {
    const duplicate = await db.visaType.findFirst({
      where: { id: { not: id }, countryId: nextCountryId, name: { equals: nextName, mode: "insensitive" } },
    });
    if (duplicate) return jsonError(400, "This visa type already exists.", { name: ["Already in the list."] });
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.visaType.update({ where: { id }, data: parsed.data, include });
    await writeAudit(tx, {
      entityType: "VisaType",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Visa type "${row.name}" updated (by ${session.name})`,
    });
    return row;
  });

  return jsonSuccess(updated);
}

/** Leads store the visa type's name, so removing an option never changes an existing request. */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;
  const reasonResult = await readDeleteReason(request);
  if (reasonResult.error) return reasonResult.error;
  const { reason } = reasonResult;

  const existing = await db.visaType.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Visa type not found.");

  await db.$transaction(async (tx) => {
    await tx.visaType.delete({ where: { id } });
    await writeAudit(tx, {
      entityType: "VisaType",
      entityId: id,
      action: "DELETE",
      byUserId: session.id,
      note: withReason(`Visa type "${existing.name}" removed (by ${session.name})`, reason),
    });
  });

  return jsonSuccess({ id });
}
