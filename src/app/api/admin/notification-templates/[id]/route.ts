import type { NextRequest } from "next/server";
import { updateNotificationTemplateSchema } from "@/lib/validation/notification-template-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

  const parsed = updateNotificationTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.notificationTemplate.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Notification template not found.");

  const nextEvent = parsed.data.event ?? existing.event;
  const nextChannel = parsed.data.channel ?? existing.channel;
  if (nextEvent !== existing.event || nextChannel !== existing.channel) {
    const clash = await db.notificationTemplate.findUnique({ where: { event_channel: { event: nextEvent, channel: nextChannel } } });
    if (clash && clash.id !== id) {
      return jsonError(400, "A template for this event and channel already exists.", {
        event: ["Already added — edit that template instead."],
      });
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.notificationTemplate.update({ where: { id }, data: parsed.data });
    await writeAudit(tx, {
      entityType: "NotificationTemplate",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Notification template "${result.event}" (${result.channel}) updated (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
