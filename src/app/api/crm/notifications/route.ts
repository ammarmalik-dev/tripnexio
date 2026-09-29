import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";
import type { StaffNotificationFeed } from "@/lib/validation/staff-notification-schema";

const FEED_LIMIT = 50;

/**
 * P22 — CRM.md §4/§26: the signed-in staff member's own notification feed
 * (latest 50, plus the total unread count and their sound preference).
 * Every staff user sees only their own rows, so no extra permission.
 */
export async function GET() {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Please sign in.");

  try {
    // Sequential on purpose: this is polled every minute by every open CRM
    // tab, so it shouldn't take three pooled connections at once.
    const rows = await db.staffNotification.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
      select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
    });
    const unreadCount = await db.staffNotification.count({ where: { userId: session.id, readAt: null } });
    const user = await db.user.findUnique({ where: { id: session.id }, select: { notificationSound: true } });

    const feed: StaffNotificationFeed = {
      notifications: rows.map((row) => ({
        ...row,
        readAt: row.readAt ? row.readAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
      })),
      unreadCount,
      sound: user?.notificationSound ?? false,
    };
    return jsonSuccess(feed);
  } catch (error) {
    console.error("[api/crm/notifications]", (error as Error).name);
    return jsonError(500, "Couldn't load notifications.");
  }
}
