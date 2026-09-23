import type { NextRequest } from "next/server";
import { updateNewVisaPricingSchema } from "@/lib/validation/new-visa-pricing-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { serializeNewVisaPricing } from "@/lib/new-visa/serialize-pricing";

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

  const parsed = updateNewVisaPricingSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  // The country and processing type are fixed once added — to change either, disable this row and add another.
  const data = { ...parsed.data };
  delete data.countryId;
  delete data.processingType;

  const existing = await db.newVisaPricing.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Pricing rule not found.");

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.newVisaPricing.update({
      where: { id },
      data,
      include: { country: { select: { name: true, code: true } } },
    });
    await writeAudit(tx, {
      entityType: "NewVisaPricing",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `New Visa pricing for ${row.country.name} (${row.processingType}) updated (by ${session.name})`,
    });
    return row;
  });

  return jsonSuccess(serializeNewVisaPricing(updated));
}
