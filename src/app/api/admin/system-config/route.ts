import type { NextRequest } from "next/server";
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

  await getOrCreateConfig();

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.systemConfig.update({ where: { id: SYSTEM_CONFIG_ID }, data: parsed.data });
    await writeAudit(tx, {
      entityType: "SystemConfig",
      entityId: SYSTEM_CONFIG_ID,
      action: "UPDATE",
      byUserId: session.id,
      note: `System configuration updated (by ${session.name})`,
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
