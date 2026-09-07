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
  /** WhatsApp only — the exact name/language of the Meta-APPROVED Message Template this row maps to. Empty means "not yet approved" (sends are skipped, not attempted). */
  metaTemplateName: z.string().trim().max(512).optional(),
  metaTemplateLanguage: z.string().trim().max(20).optional(),
});

export const updateNotificationTemplateSchema = createNotificationTemplateSchema.partial();

/** `to` is an email for an EMAIL template's test-send, or a WhatsApp id (digits) for a WHATSAPP one — the route validates the shape against the template's own channel since this schema alone can't know which. */
export const testSendNotificationTemplateSchema = z.object({
  to: z.string().trim().min(1, "This field is required"),
});

export type CreateNotificationTemplateValues = z.infer<typeof createNotificationTemplateSchema>;
export type UpdateNotificationTemplateValues = z.infer<typeof updateNotificationTemplateSchema>;
export type TestSendNotificationTemplateValues = z.infer<typeof testSendNotificationTemplateSchema>;
