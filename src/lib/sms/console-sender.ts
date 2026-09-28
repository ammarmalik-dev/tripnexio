import crypto from "crypto";
import type { SmsSender, SendSmsInput, SendSmsResult } from "./sender";
import { maskRecipient } from "../logging/mask";

/**
 * The only SmsSender implementation that exists today — there's no real
 * SMS gateway wired up yet because, unlike Razorpay/Resend/WhatsApp/
 * Anthropic (all "TODO: client provides a key for a provider we already
 * picked"), the client hasn't told us WHICH SMS gateway they want (Twilio,
 * MSG91, etc. — this is a real open question, not just a missing key).
 * Once that's answered, add a real sender (e.g. `twilio-sender.ts`) and
 * pick it in `get-sender.ts` the same way `getEmailSender()` does — this
 * class and its console-logging behavior would stay exactly as the
 * fallback for local dev, unchanged.
 */
export class ConsoleSmsSender implements SmsSender {
  readonly providerName = "console (no SMS gateway configured)";

  async send(input: SendSmsInput): Promise<SendSmsResult> {
    const id = `console_${crypto.randomUUID()}`;
    console.log(`[sms:console] not delivered (no SMS gateway configured) to ${maskRecipient(input.to)}`);
    return { id };
  }
}
