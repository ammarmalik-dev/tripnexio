import type { NextRequest } from "next/server";
import { createNewVisaPricingSchema } from "@/lib/validation/new-visa-pricing-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { serializeNewVisaPricing } from "@/lib/new-visa/serialize-pricing";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const rows = await db.newVisaPricing.findMany({
    orderBy: [{ displayOrder: "asc" }, { country: { name: "asc" } }, { processingType: "asc" }],
    include: { country: { select: { name: true, code: true } } },
  });
  return jsonSuccess(rows.map(serializeNewVisaPricing));
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

  const parsed = createNewVisaPricingSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const country = await db.country.findUnique({ where: { id: parsed.data.countryId } });
  if (!country) return jsonError(400, "Country not found.", { countryId: ["Select a valid country."] });

  const existing = await db.newVisaPricing.findUnique({
    where: { countryId_processingType: { countryId: parsed.data.countryId, processingType: parsed.data.processingType } },
  });
  if (existing) {
    return jsonError(400, "This country already has a rate for this processing type.", { countryId: ["Already added."] });
  }

  const created = await db.$transaction(async (tx) => {
    const row = await tx.newVisaPricing.create({
      data: parsed.data,
      include: { country: { select: { name: true, code: true } } },
    });
    await writeAudit(tx, {
      entityType: "NewVisaPricing",
      entityId: row.id,
      action: "CREATE",
      byUserId: session.id,
      note: `New Visa pricing added for ${row.country.name} (${row.processingType}) — adult ₹${parsed.data.adultPrice}, child ₹${parsed.data.childPrice}, infant ₹${parsed.data.infantPrice} (by ${session.name})`,
    });
    return row;
  });

  return jsonSuccess(serializeNewVisaPricing(created), 201);
}
