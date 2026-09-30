import type { NextRequest } from "next/server";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { revalidatePath } from "next/cache";
import { updateSystemConfigSchema } from "@/lib/validation/system-config-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

const SYSTEM_CONFIG_ID = "singleton";

/** Self-healing, same pattern as /api/admin/service-timelines — the row is pre-seeded, but a GET never 404s if it's somehow missing. */
async function getOrCreateConfig() {
  const existing = await db.systemConfig.findUnique({ where: { id: SYSTEM_CONFIG_ID } });
  if (existing) return existing;
  return db.systemConfig.create({ data: { id: SYSTEM_CONFIG_ID } });
}

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const config = await getOrCreateConfig();
  return jsonSuccess(config);
}

export async function PATCH(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateSystemConfigSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const current = await getOrCreateConfig();
  const startHour = parsed.data.workdayStartHour ?? current.workdayStartHour;
  const endHour = parsed.data.workdayEndHour ?? current.workdayEndHour;
  if (endHour <= startHour) {
    return jsonError(400, "The working day must end after it starts.", { workdayEndHour: ["Must be later than the start hour."] });
  }

  // P27 - the retention period decides when every document file is deleted: changing it needs a reason.
  const retentionChanged = parsed.data.documentRetentionDays !== undefined && parsed.data.documentRetentionDays !== current.documentRetentionDays;
  let retentionReason: string | undefined;
  if (retentionChanged) {
    const reasonResult = readBodyReason(body);
    if (reasonResult.error) return reasonResult.error;
    retentionReason = reasonResult.reason;
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.systemConfig.update({ where: { id: SYSTEM_CONFIG_ID }, data: parsed.data });
    const baseNote = retentionChanged
      ? `System configuration updated; document retention ${current.documentRetentionDays} -> ${parsed.data.documentRetentionDays} days (by ${session.name})`
      : `System configuration updated (by ${session.name})`;
    await writeAudit(tx, {
      entityType: "SystemConfig",
      entityId: SYSTEM_CONFIG_ID,
      action: "UPDATE",
      byUserId: session.id,
      note: retentionReason ? withReason(baseNote, retentionReason) : baseNote,
    });
    return result;
  });

  // Real bug caught in testing: the root layout's getSystemConfig() calls
  // (maintenance banner, page metadata) don't automatically make every
  // page dynamic — the homepage and other static customer pages cache
  // their rendered HTML at build time, so a plain DB write here would sit
  // invisible until the next deploy. revalidatePath("/", "layout")
  // invalidates every route under the root layout on-demand, so the very
  // next request after this save picks up the change immediately,
  // without forcing the whole site into dynamic rendering (which would
  // undo Next's static optimization for every marketing page).
  revalidatePath("/", "layout");

  return jsonSuccess(updated);
}
