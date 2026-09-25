export interface SendSmsInput {
  to: string;
  body: string;
}

export interface SendSmsResult {
  /** The provider's own id for this send, when it returns one. */
  id: string | null;
}

/**
 * Service-layer interface so a real SMS gateway (Twilio, MSG91, etc. —
 * the client's choice, not yet made) can be swapped in later without
 * touching any call site, same pattern as EmailSender/WhatsAppGateway/
 * PaymentGateway.
 */
export interface SmsSender {
  readonly providerName: string;
  send(input: SendSmsInput): Promise<SendSmsResult>;
}
