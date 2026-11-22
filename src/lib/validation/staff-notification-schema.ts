import { z } from "zod";

/** POST /api/crm/notifications/read — mark specific notifications, or all of them, as read. */
export const markStaffNotificationsReadSchema = z.union([
  z.object({ ids: z.array(z.string().min(1)).min(1, "Nothing to mark as read.").max(100) }),
  z.object({ all: z.literal(true) }),
  /** Client doc 16 Nov (L1) — opening WhatsApp Chats clears its chat alerts. */
  z.object({ type: z.literal("WHATSAPP_CHAT") }),
]);
export type MarkStaffNotificationsReadInput = z.infer<typeof markStaffNotificationsReadSchema>;

/** PATCH /api/crm/notifications/preferences — CRM.md §33 sound control. */
export const staffNotificationPreferencesSchema = z.object({ sound: z.boolean() });
export type StaffNotificationPreferencesInput = z.infer<typeof staffNotificationPreferencesSchema>;

/** Shape GET /api/crm/notifications returns — shared with the topbar panel. */
export interface StaffNotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface StaffNotificationFeed {
  notifications: StaffNotificationItem[];
  unreadCount: number;
  /** Client doc 16 Nov (L1) — unread WhatsApp chat alerts, shown on the WhatsApp Chats menu item (not in the bell). */
  whatsappUnread: number;
  sound: boolean;
}

/** Client doc 16 Nov (L1) — WhatsApp chat alerts live in the WhatsApp section, not in the general notifications. */
export const WHATSAPP_CHAT_NOTIFICATION = "WHATSAPP_CHAT";
