import { sendNotificationEmail } from "./send-notification-email";
import { sendNotificationWhatsApp } from "./send-notification-whatsapp";
import { sendNotificationSms } from "./send-notification-sms";
import type { EmailAttachment } from "../email/sender";

export interface NotifyCustomerInput {
  event: string;
  emailTo: string | null | undefined;
  /** Customer's WhatsApp id (see src/lib/whatsapp/phone.ts's toWhatsAppId) — null/undefined skips the WhatsApp send (audited, not an error). */
  whatsappTo: string | null | undefined;
  /**
   * Customer's phone number for SMS (Item 11) — same normalized value as
   * whatsappTo is fine to reuse (toWhatsAppId's E.164-ish digits are what
   * an SMS gateway wants too); null/undefined skips the SMS send (audited,
   * not an error).
   */
  smsTo?: string | null | undefined;
  variables: Record<string, string>;
  auditTarget: { entityType: string; entityId: string };
  emailAttachments?: EmailAttachment[];
}

/**
 * Single entry point every trigger site calls instead of the three
 * channel-specific senders directly — fires all three, each independently
 * audited and independently fault-tolerant (a failure on one channel never
 * blocks or is blocked by another).
 */
export async function notifyCustomer(input: NotifyCustomerInput): Promise<void> {
  await Promise.all([
    sendNotificationEmail({
      event: input.event,
      to: input.emailTo,
      variables: input.variables,
      auditTarget: input.auditTarget,
      attachments: input.emailAttachments,
    }),
    sendNotificationWhatsApp({
      event: input.event,
      to: input.whatsappTo,
      variables: input.variables,
      auditTarget: input.auditTarget,
    }),
    sendNotificationSms({
      event: input.event,
      to: input.smsTo,
      variables: input.variables,
      auditTarget: input.auditTarget,
    }),
  ]);
}
