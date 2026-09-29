import type { NextRequest } from "next/server";
import { createOtbPriceSchema } from "@/lib/validation/otb-price-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { serializeOtbPrice } from "@/lib/otb/pricing";

const INCLUDE = { airline: { select: { name: true, code: true } }, country: { select: { name: true, code: true } } } as const;

/** P18 — Admin list of OTB prices (airline + destination country + passenger type). */
export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const rows = await db.otbPrice.findMany({
    orderBy: [{ airline: { name: "asc" } }, { country: { name: "asc" } }, { paxType: "asc" }],
    include: INCLUDE,
  });
  return jsonSuccess(rows.map(serializeOtbPrice));
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
  const parsed = createOtbPriceSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  const [airline, country] = await Promise.all([
    db.airline.findUnique({ where: { id: parsed.data.airlineId }, select: { id: true } }),
    db.country.findUnique({ where: { id: parsed.data.countryId }, select: { id: true } }),
  ]);
  if (!airline) return jsonError(400, "Airline not found.", { airlineId: ["Select a valid airline."] });
  if (!country) return jsonError(400, "Country not found.", { countryId: ["Select a valid country."] });
  const duplicate = await db.otbPrice.findUnique({
    where: { airlineId_countryId_paxType: { airlineId: airline.id, countryId: country.id, paxType: parsed.data.paxType } },
  });
  if (duplicate) return jsonError(400, "A price for this airline, country and passenger type already exists.", { paxType: ["Already added."] });

  const created = await db.$transaction(async (tx) => {
    const row = await tx.otbPrice.create({ data: parsed.data, include: INCLUDE });
    await writeAudit(tx, {
      entityType: "OtbPrice",
      entityId: row.id,
      action: "CREATE",
      byUserId: session.id,
      note: `OTB price ${row.airline.code} → ${row.country.name} (${row.paxType}): normal ${parsed.data.normalPrice}, urgent ${parsed.data.urgentPrice ?? "airline price"} (by ${session.name})`,
    });
    return row;
  });
  return jsonSuccess(serializeOtbPrice(created), 201);
}
