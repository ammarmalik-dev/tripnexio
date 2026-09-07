import type { NextRequest } from "next/server";
import { createNotificationTemplateSchema } from "@/lib/validation/notification-template-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const templates = await db.notificationTemplate.findMany({ orderBy: [{ channel: "asc" }, { event: "asc" }] });
  return jsonSuccess(templates);
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
    return jsonError(400, "A template for this event and channel already exists.", {
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
