import { z } from "zod";

/**
 * Manual send from the CRM Communications module (Step 18, audit §3.7).
 * EMAIL needs its own subject (there's no template involved — this is a
 * staff-composed one-off, unlike the NotificationTemplate-driven automated
 * sends); WHATSAPP is a freeform session message, only deliverable within
 * the 24-hour window (enforced server-side, not by this schema).
 */
export const sendCommunicationSchema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("EMAIL"),
    subject: z.string().trim().min(1, "Enter a subject.").max(200),
    body: z.string().trim().min(1, "Enter a message.").max(10000),
  }),
  z.object({
    channel: z.literal("WHATSAPP"),
    body: z.string().trim().min(1, "Enter a message.").max(4096),
  }),
]);

export type SendCommunicationValues = z.infer<typeof sendCommunicationSchema>;
