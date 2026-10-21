import type { NextRequest } from "next/server";
import { createHolidaySchema } from "@/lib/validation/holiday-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

/** Admin holiday calendar (P09) — every holiday for one year, every country (client corrections 2026-10-05). */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const year = Number(new URL(request.url).searchParams.get("year")) || new Date().getUTCFullYear();
  const holidays = await db.holiday.findMany({
    where: { date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
    orderBy: [{ date: "asc" }, { country: "asc" }],
    include: { countryRecord: { select: { name: true } } },
  });
  return jsonSuccess(
    holidays.map(({ countryRecord, ...holiday }) => ({
      ...holiday,
      countryName: countryRecord?.name ?? (holiday.country === "UAE" ? "UAE" : holiday.country === "INDIA" ? "India" : "—"),
    }))
  );
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

  const from = new Date(`${parsed.data.date}T00:00:00Z`);
  const to = parsed.data.toDate ? new Date(`${parsed.data.toDate}T00:00:00Z`) : from;
  if (to < from) return jsonError(400, "Please check the highlighted fields.", { toDate: ["The end date must be on or after the start date."] });
  const DAY = 24 * 60 * 60 * 1000;
  const days = Math.round((to.getTime() - from.getTime()) / DAY) + 1;
  if (days > 92) return jsonError(400, "Please check the highlighted fields.", { toDate: ["Block at most 92 days at a time."] });
  const country = await db.country.findFirst({ where: { id: parsed.data.countryId, active: true }, select: { id: true, name: true } });
  if (!country) return jsonError(400, "Please check the highlighted fields.", { countryId: ["Select an active country."] });
  const dates = Array.from({ length: days }, (_, index) => new Date(from.getTime() + index * DAY));
  const existing = await db.holiday.findMany({ where: { countryId: country.id, date: { in: dates } }, select: { date: true } });
  const taken = new Set(existing.map((row) => row.date.getTime()));
  const fresh = dates.filter((date) => !taken.has(date.getTime()));
  if (fresh.length === 0) {
    return jsonError(400, days === 1 ? "That date is already a holiday for this country." : "Every date in that range is already a holiday for this country.", { date: ["Already in the calendar."] });
  }

  const created = await db.$transaction(async (tx) => {
    const rows = [];
    for (const date of fresh) {
      const row = await tx.holiday.create({ data: { date, countryId: country.id, name: parsed.data.name } });
      rows.push(row);
    }
    await writeAudit(tx, {
      entityType: "Holiday",
      entityId: rows[0].id,
      action: "CREATE",
      byUserId: session.id,
      note:
        rows.length === 1
          ? `Holiday "${parsed.data.name}" (${country.name}, ${parsed.data.date}) added (by ${session.name})`
          : `Holiday "${parsed.data.name}" (${country.name}, ${parsed.data.date} to ${parsed.data.toDate}) added for ${rows.length} dates${dates.length > rows.length ? `, ${dates.length - rows.length} already in the calendar` : ""} (by ${session.name})`,
    });
    return rows;
  });
  return jsonSuccess({ created: created.map((row) => ({ ...row, countryName: country.name })), skipped: dates.length - created.length }, 201);
}
