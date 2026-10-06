import type { EmailHero } from "./layout";

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  /** The message body (a fragment) — the sender wraps it in the branded layout (src/lib/email/layout.ts). */
  html: string;
  attachments?: EmailAttachment[];
  /** Optional illustration + heading + status pill above the message (client corrections 2026-10-05). */
  hero?: EmailHero | null;
}

export interface SendEmailResult {
  /** The provider's own id for this send, when it returns one. */
  id: string | null;
}

/** Service-layer interface so Resend can be swapped for another provider later without touching any call site. */
export interface EmailSender {
  readonly providerName: string;
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
