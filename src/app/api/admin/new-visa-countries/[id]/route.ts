import { checkProductMasters } from "@/lib/visa-masters/check-product-masters";
import type { NextRequest } from "next/server";
import { updateNewVisaCountryConfigSchema } from "@/lib/validation/new-visa-country-config-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { readDeleteReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";

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

  const parsed = updateNewVisaCountryConfigSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  // The country is fixed once added — to change it, remove this row and add another.
  const data = { ...parsed.data };
  const masterErrors = await checkProductMasters({ stayDays: data.stayDays, validityTypeId: data.validityTypeId });
  if (masterErrors) return jsonError(400, "Please check the highlighted fields.", masterErrors);
  delete data.countryId;

  const existing = await db.newVisaCountryConfig.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "New Visa country config not found.");

  const nextStay = data.stayDays ?? existing.stayDays;
  const nextEntry = data.entryKind ?? existing.entryKind;
  if ((data.stayDays !== undefined || data.entryKind !== undefined) && nextStay && nextEntry) {
    const clash = await db.newVisaCountryConfig.findFirst({ where: { countryId: existing.countryId, stayDays: nextStay, entryKind: nextEntry, id: { not: id } } });
    if (clash) return jsonError(400, "This country already has that stay duration and entry type.", { stayDays: ["Already added."] });
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.newVisaCountryConfig.update({
      where: { id },
      data,
      include: { country: { select: { id: true, name: true, code: true } } },
    });
    await writeAudit(tx, {
      entityType: "NewVisaCountryConfig",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `New Visa country config for "${row.country.name}" updated (by ${session.name})`,
    });
    return row;
  });

  return jsonSuccess(updated);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;
  const reasonResult = await readDeleteReason(request);
  if (reasonResult.error) return reasonResult.error;
  const { reason } = reasonResult;

  const existing = await db.newVisaCountryConfig.findUnique({
    where: { id },
    include: { country: { select: { name: true } } },
  });
  if (!existing) return jsonError(404, "New Visa country config not found.");

  await db.$transaction(async (tx) => {
    await tx.newVisaCountryConfig.delete({ where: { id } });
    await writeAudit(tx, {
      entityType: "NewVisaCountryConfig",
      entityId: id,
      action: "DELETE",
      byUserId: session.id,
      note: withReason(`New Visa country config for "${existing.country.name}" removed (by ${session.name})`, reason),
    });
  });

  return jsonSuccess({ id });
}
