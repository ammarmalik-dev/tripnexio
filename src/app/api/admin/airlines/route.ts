import type { NextRequest } from "next/server";
import { createAirlineSchema } from "@/lib/validation/airline-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const airlines = await db.airline.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }] });
  return jsonSuccess(airlines);
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

  const parsed = createAirlineSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.airline.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return jsonError(400, "An airline with this code already exists.", { code: ["This code is taken."] });
  }

  const airline = await db.$transaction(async (tx) => {
    const created = await tx.airline.create({ data: parsed.data });
    await writeAudit(tx, {
      entityType: "Airline",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Airline "${created.name}" (${created.code}) created (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(airline, 201);
}
