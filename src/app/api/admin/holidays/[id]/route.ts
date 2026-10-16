import type { NextRequest } from "next/server";
import { updateHolidaySchema } from "@/lib/validation/holiday-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { readDeleteReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Rename, re-date (client doc 2026-10-15, J6) or enable/disable a holiday — disabling keeps the record but stops working-day rules skipping it. */
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
  const parsed = updateHolidaySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.holiday.findUnique({ where: { id }, include: { countryRecord: { select: { name: true } } } });
  if (!existing) return jsonError(404, "Holiday not found.");

  const { date, ...rest } = parsed.data;
  const newDate = date ? new Date(`${date}T00:00:00Z`) : undefined;
  if (newDate && newDate.getTime() !== existing.date.getTime()) {
    const clash = await db.holiday.findFirst({
      where: { id: { not: id }, date: newDate, ...(existing.countryId ? { countryId: existing.countryId } : { country: existing.country }) },
      select: { id: true },
    });
    if (clash) return jsonError(409, "This country already has a holiday on that date.", { date: ["Already a holiday"] });
  }

  const changes: string[] = [];
  if (rest.name !== undefined && rest.name !== existing.name) changes.push(`renamed "${existing.name}" -> "${rest.name}"`);
  if (newDate && newDate.getTime() !== existing.date.getTime()) changes.push(`date ${existing.date.toISOString().slice(0, 10)} -> ${date}`);
  if (rest.active !== undefined && rest.active !== existing.active) changes.push(rest.active ? "enabled" : "disabled");

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.holiday.update({ where: { id }, data: { ...rest, ...(newDate ? { date: newDate } : {}) } });
    await writeAudit(tx, {
      entityType: "Holiday",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Holiday "${row.name}" (${existing.countryRecord?.name ?? row.country ?? "—"}) ${changes.join(", ") || "saved"} (by ${session.name})`,
    });
    return row;
  });
  return jsonSuccess(updated);
}

/** Client doc 2026-10-15 (J6) — delete a holiday added by mistake (reason required, audited). */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  const reason = await readDeleteReason(request);
  if (reason.error) return reason.error;

  const existing = await db.holiday.findUnique({ where: { id }, include: { countryRecord: { select: { name: true } } } });
  if (!existing) return jsonError(404, "Holiday not found.");

  await db.$transaction(async (tx) => {
    await tx.holiday.delete({ where: { id } });
    await writeAudit(tx, {
      entityType: "Holiday",
      entityId: id,
      action: "DELETE",
      byUserId: session.id,
      note: withReason(
        `Holiday "${existing.name}" on ${existing.date.toISOString().slice(0, 10)} (${existing.countryRecord?.name ?? existing.country ?? "—"}) deleted (by ${session.name})`,
        reason.reason
      ),
    });
  });
  return jsonSuccess({ id });
}
