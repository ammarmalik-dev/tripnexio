import { sendNotificationEmail } from "./send-notification-email";
import { sendNotificationWhatsApp } from "./send-notification-whatsapp";
import type { EmailAttachment } from "../email/sender";

export interface NotifyCustomerInput {
  event: string;
  emailTo: string | null | undefined;
  /** Customer's WhatsApp id (see src/lib/whatsapp/phone.ts's toWhatsAppId) — null/undefined skips the WhatsApp send (audited, not an error). */
  whatsappTo: string | null | undefined;
  variables: Record<string, string>;
  auditTarget: { entityType: string; entityId: string };
  emailAttachments?: EmailAttachment[];
}

/**
 * Single entry point every trigger site calls instead of the two
 * channel-specific senders directly — fires both, each independently
 * audited and independently fault-tolerant (a WhatsApp failure never blocks
 * or is blocked by the email send, and vice versa).
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
  ]);
}
