import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";
import { writeAudit } from "@/lib/audit/log";
import { staffNotificationPreferencesSchema } from "@/lib/validation/staff-notification-schema";

/** P22 — CRM.md §33: the signed-in staff member's own notification-sound preference. */
export async function PATCH(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Please sign in.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = staffNotificationPreferencesSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Invalid request.", parsed.error.flatten().fieldErrors);

  try {
    const { sound } = parsed.data;
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: session.id }, data: { notificationSound: sound } });
      await writeAudit(tx, {
        entityType: "User",
        entityId: session.id,
        action: "NOTIFICATION_SOUND",
        byUserId: session.id,
        note: `Notification sound turned ${sound ? "on" : "off"} (by ${session.name})`,
      });
    });
    return jsonSuccess({ sound });
  } catch (error) {
    console.error("[api/crm/notifications/preferences]", (error as Error).name);
    return jsonError(500, "Couldn't save your preference.");
  }
}
