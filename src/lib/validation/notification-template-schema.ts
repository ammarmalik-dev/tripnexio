import { z } from "zod";
import { NotificationChannel, type NotificationChannel as NotificationChannelType } from "../../generated/prisma/enums";

const channelValues = Object.values(NotificationChannel) as [NotificationChannelType, ...NotificationChannelType[]];

export const createNotificationTemplateSchema = z.object({
  event: z.string().trim().min(2, "Enter an event name").max(80, "Event name is too long"),
  channel: z.enum(channelValues, { error: "Select a channel" }),
  /** Email only — ignored/cleared for WhatsApp. */
  subject: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1, "Enter the message body"),
  active: z.boolean().default(true),
});

export const updateNotificationTemplateSchema = createNotificationTemplateSchema.partial();

export type CreateNotificationTemplateValues = z.infer<typeof createNotificationTemplateSchema>;
export type UpdateNotificationTemplateValues = z.infer<typeof updateNotificationTemplateSchema>;
