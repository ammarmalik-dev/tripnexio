import type { SmsSender } from "./sender";
import { ConsoleSmsSender } from "./console-sender";

let cached: SmsSender | null = null;

/**
 * Always returns the console fallback today — there's no real provider to
 * select between yet (see ConsoleSmsSender's own doc comment: the client
 * hasn't chosen an SMS gateway). Kept as its own function, matching
 * getEmailSender()/getPaymentGateway()'s exact shape, so that once a
 * provider is chosen this becomes a one-line change (an isPlaceholder()
 * check on that provider's key, same as every other integration) rather
 * than a new pattern.
 */
export function getSmsSender(): SmsSender {
  if (cached) return cached;
  cached = new ConsoleSmsSender();
  return cached;
}
