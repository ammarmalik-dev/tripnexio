import type { NextRequest } from "next/server";
import { createVisaTypeSchema } from "@/lib/validation/visa-type-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

const include = { country: { select: { id: true, name: true } } } as const;

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const visaTypes = await db.visaType.findMany({ include, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] });
  return jsonSuccess(visaTypes);
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

  const parsed = createVisaTypeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  const countryId = parsed.data.countryId ?? null;

  if (countryId && !(await db.country.findUnique({ where: { id: countryId } }))) {
    return jsonError(400, "Select a valid country.", { countryId: ["Select a valid country."] });
  }
  const duplicate = await db.visaType.findFirst({ where: { countryId, name: { equals: parsed.data.name, mode: "insensitive" } } });
  if (duplicate) return jsonError(400, "This visa type already exists.", { name: ["Already in the list."] });

  const created = await db.$transaction(async (tx) => {
    const row = await tx.visaType.create({ data: { ...parsed.data, countryId }, include });
    await writeAudit(tx, {
      entityType: "VisaType",
      entityId: row.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Visa type "${row.name}"${row.country ? ` (${row.country.name})` : ""} added (by ${session.name})`,
    });
    return row;
  });

  return jsonSuccess(created, 201);
}
