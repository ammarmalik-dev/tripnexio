export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
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
