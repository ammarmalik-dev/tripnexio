import type { NextRequest } from "next/server";
import { createCountrySchema } from "@/lib/validation/country-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const countries = await db.country.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }] });
  return jsonSuccess(countries);
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

  const parsed = createCountrySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.country.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return jsonError(400, "A country with this code already exists.", { code: ["This code is taken."] });
  }

  const country = await db.$transaction(async (tx) => {
    const created = await tx.country.create({ data: parsed.data });
    await writeAudit(tx, {
      entityType: "Country",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Country "${created.name}" (${created.code}) created (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(country, 201);
}
