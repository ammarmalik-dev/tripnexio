import type { NextRequest } from "next/server";
import { createNationalitySchema } from "@/lib/validation/nationality-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

const include = { country: { select: { id: true, name: true, code: true, flagOverride: true } } } as const;

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const nationalities = await db.nationality.findMany({ include, orderBy: { name: "asc" } });
  return jsonSuccess(nationalities);
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

  const parsed = createNationalitySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  if (!(await db.country.findUnique({ where: { id: parsed.data.countryId } }))) {
    return jsonError(400, "Select a valid country.", { countryId: ["Select a valid country."] });
  }
  const duplicate = await db.nationality.findFirst({ where: { name: { equals: parsed.data.name, mode: "insensitive" } } });
  if (duplicate) return jsonError(400, "This nationality already exists.", { name: ["Already in the list."] });

  const created = await db.$transaction(async (tx) => {
    const row = await tx.nationality.create({ data: parsed.data, include });
    await writeAudit(tx, {
      entityType: "Nationality",
      entityId: row.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Nationality "${row.name}" added (by ${session.name})`,
    });
    return row;
  });

  return jsonSuccess(created, 201);
}
