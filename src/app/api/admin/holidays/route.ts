import type { NextRequest } from "next/server";
import { createHolidaySchema } from "@/lib/validation/holiday-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

/** Admin holiday calendar (P09) — every holiday for one year, both countries. */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const year = Number(new URL(request.url).searchParams.get("year")) || new Date().getUTCFullYear();
  const holidays = await db.holiday.findMany({
    where: { date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
    orderBy: [{ date: "asc" }, { country: "asc" }],
  });
  return jsonSuccess(holidays);
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
  const parsed = createHolidaySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const date = new Date(`${parsed.data.date}T00:00:00Z`);
  const existing = await db.holiday.findUnique({ where: { date_country: { date, country: parsed.data.country } } });
  if (existing) return jsonError(400, "That date is already a holiday for this country.", { date: ["Already in the calendar."] });

  const created = await db.$transaction(async (tx) => {
    const row = await tx.holiday.create({ data: { date, country: parsed.data.country, name: parsed.data.name } });
    await writeAudit(tx, {
      entityType: "Holiday",
      entityId: row.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Holiday "${row.name}" (${row.country}, ${parsed.data.date}) added (by ${session.name})`,
    });
    return row;
  });
  return jsonSuccess(created, 201);
}
