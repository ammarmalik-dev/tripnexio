import type { NextRequest } from "next/server";
import { createNotificationTemplateSchema } from "@/lib/validation/notification-template-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

/**
 * Client 2026-10-28 — only the templates in use (active) by default; `?retired=include` adds the retired / disabled
 * ones (the Admin screen groups them by service from the event code).
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  try {
    const includeRetired = request.nextUrl.searchParams.get("retired") === "include";
    const templates = await db.notificationTemplate.findMany({
      where: includeRetired ? undefined : { active: true },
      orderBy: [{ channel: "asc" }, { event: "asc" }],
    });
    return jsonSuccess(templates);
  } catch (error) {
    console.error("[admin/notification-templates] list failed", error instanceof Error ? error.message : "unknown");
    return jsonError(500, "Couldn't load notification templates.");
  }
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

  const parsed = createNotificationTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.notificationTemplate.findUnique({
    where: { event_channel: { event: parsed.data.event, channel: parsed.data.channel } },
  });
  if (existing) {
    return jsonError(400, existing.active ? "A template for this event and channel already exists." : "A retired template for this event and channel already exists — tick \"Show retired templates\" and enable it instead.", {
      event: ["Already added — edit the existing template instead."],
    });
  }

  const template = await db.$transaction(async (tx) => {
    const created = await tx.notificationTemplate.create({ data: parsed.data });
    await writeAudit(tx, {
      entityType: "NotificationTemplate",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Notification template "${created.event}" (${created.channel}) created (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(template, 201);
}
