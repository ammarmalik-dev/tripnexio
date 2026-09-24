import type { NextRequest } from "next/server";
import { createNewVisaCountryConfigSchema } from "@/lib/validation/new-visa-country-config-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const configs = await db.newVisaCountryConfig.findMany({
    orderBy: [{ country: { displayOrder: "asc" } }, { country: { name: "asc" } }],
    include: { country: { select: { id: true, name: true, code: true } } },
  });
  return jsonSuccess(configs);
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

  const parsed = createNewVisaCountryConfigSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const country = await db.country.findUnique({ where: { id: parsed.data.countryId } });
  if (!country) return jsonError(400, "Country not found.", { countryId: ["Select a valid country."] });

  const existing = await db.newVisaCountryConfig.findUnique({ where: { countryId: country.id } });
  if (existing) {
    return jsonError(400, "This country is already set up for New Visa.", { countryId: ["Already added."] });
  }

  const created = await db.$transaction(async (tx) => {
    const row = await tx.newVisaCountryConfig.create({
      data: parsed.data,
      include: { country: { select: { id: true, name: true, code: true } } },
    });
    await writeAudit(tx, {
      entityType: "NewVisaCountryConfig",
      entityId: row.id,
      action: "CREATE",
      byUserId: session.id,
      note: `New Visa country config for "${row.country.name}" added (by ${session.name})`,
    });
    return row;
  });

  return jsonSuccess(created, 201);
}
