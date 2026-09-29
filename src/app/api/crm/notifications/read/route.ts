import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";
import { markStaffNotificationsReadSchema } from "@/lib/validation/staff-notification-schema";

/**
 * P22 — marks the caller's own notifications as read: `{ ids: [...] }` or
 * `{ all: true }`. Always scoped to `userId = session.id`, so an id that
 * belongs to someone else is silently ignored rather than touched.
 */
export async function POST(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Please sign in.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = markStaffNotificationsReadSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Invalid request.");

  try {
    const where =
      "all" in parsed.data
        ? { userId: session.id, readAt: null }
        : { userId: session.id, readAt: null, id: { in: parsed.data.ids } };
    const result = await db.staffNotification.updateMany({ where, data: { readAt: new Date() } });
    const unreadCount = await db.staffNotification.count({ where: { userId: session.id, readAt: null } });
    return jsonSuccess({ updated: result.count, unreadCount });
  } catch (error) {
    console.error("[api/crm/notifications/read]", (error as Error).name);
    return jsonError(500, "Couldn't update notifications.");
  }
}
