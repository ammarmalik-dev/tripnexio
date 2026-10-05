/**
 * Payment gateway service layer — every route talks to this interface, never
 * to a specific provider's SDK directly, so the provider can be swapped
 * later without touching route code. Razorpay was chosen for being
 * INR/GST-friendly (see CLAUDE.md's locked India-to-GCC market scope).
 */

export interface CreatePaymentLinkInput {
  /** Rupees, not paise — the gateway implementation converts as needed. */
  amountInRupees: number;
  /** Shown on the gateway's hosted checkout page. */
  description: string;
  customerName: string;
  /** E.164-ish mobile string as already stored on Customer — the gateway implementation normalizes if needed. */
  customerMobile: string;
  customerEmail: string | null;
  /** Arbitrary key-value metadata attached to the gateway's order/link (e.g. bookingId, paymentId) for reconciliation. */
  notes: Record<string, string>;
  expiresAt: Date;
}

export interface CreatePaymentLinkResult {
  /** The gateway's own id for this link/order — stored as Payment.gatewayRef and used to match incoming webhooks. */
  gatewayRef: string;
  /** The hosted checkout URL — stored as Payment.paymentLink. */
  paymentLink: string;
}

export type GatewayWebhookEventType = "PAYMENT_SUCCESS" | "PAYMENT_FAILED";

export interface GatewayWebhookEvent {
  type: GatewayWebhookEventType;
  /** Matches CreatePaymentLinkResult.gatewayRef — how we find the Payment row this event is about. */
  gatewayRef: string;
  /** The gateway's own id for the actual payment attempt (distinct from the link/order id) — recorded in the audit note for traceability. */
  gatewayPaymentId: string | null;
  /** Raw provider event name, for logging/debugging (e.g. "payment_link.paid"). */
  rawEventName: string;
  /** Amount the gateway reports as paid, in paise — null when the payload doesn't carry one. */
  amountInPaise: number | null;
  /** ISO currency code reported by the gateway (e.g. "INR") — null when absent. */
  currency: string | null;
  /** The gateway's own event id when it's in the payload body (Razorpay sends it as a header instead — see the webhook route). */
  eventId: string | null;
}

/** What the gateway currently says about one payment link (the "Check status" action). */
export interface GatewayLinkStatus {
  paid: boolean;
  gatewayPaymentId: string | null;
  amountInPaise: number | null;
  currency: string | null;
}

export interface PaymentGateway {
  readonly providerName: string;
  createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult>;
  /** Asks the gateway for a link's current state, so a missed webhook can be recovered without a manual override. */
  fetchPaymentLinkStatus(gatewayRef: string): Promise<GatewayLinkStatus>;
  /** Returns null if the signature is invalid or the payload isn't a recognized event — callers must reject the webhook request in that case. */
  verifyAndParseWebhook(rawBody: string, signatureHeader: string | null): GatewayWebhookEvent | null;
}
