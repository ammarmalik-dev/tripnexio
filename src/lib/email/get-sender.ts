import type { EmailSender, SendEmailInput, SendEmailResult } from "./sender";
import { ResendEmailSender } from "./resend-sender";
import { ConsoleEmailSender } from "./console-sender";
import { appendEmailFooter, defaultEmailFooter } from "./footer";
import { isPlaceholder } from "@/lib/env-placeholder";
import { getSiteContact, getSystemConfig } from "@/lib/settings/system-config";

const DEFAULT_FROM_ADDRESS = "TripNexio <no-reply@tripnexio.com>";

let cached: EmailSender | null = null;

/**
 * Adds the "automatically generated, do not reply" disclaimer to every email,
 * whichever provider sends it and wherever it comes from (notifications,
 * OTP, password reset, staff messages, system alerts). Text is read per send
 * so an Admin change applies at once; if it can't be read, the default is used.
 */
class FooterEmailSender implements EmailSender {
  readonly providerName: string;

  constructor(private readonly inner: EmailSender) {
    this.providerName = inner.providerName;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    let footer: string;
    try {
      const [config, contact] = [await getSystemConfig(), await getSiteContact()];
      footer = config.emailFooterText?.trim() ? config.emailFooterText : defaultEmailFooter(contact.phone);
    } catch {
      footer = defaultEmailFooter("+91 92381 84005");
    }
    return this.inner.send({ ...input, html: appendEmailFooter(input.html, footer) });
  }
}

/**
 * Selects the real Resend integration once RESEND_API_KEY is filled in (see
 * .env.example), and falls back to ConsoleEmailSender until then — this is
 * the ONLY place that decides which provider is active, mirroring
 * getPaymentGateway()'s pattern for the exact same reason (swappable
 * service layer, keys the client hasn't provided yet).
 */
export function getEmailSender(): EmailSender {
  if (cached) return cached;

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = isPlaceholder(process.env.RESEND_FROM_EMAIL) ? DEFAULT_FROM_ADDRESS : process.env.RESEND_FROM_EMAIL!;

  cached = new FooterEmailSender(isPlaceholder(apiKey) ? new ConsoleEmailSender() : new ResendEmailSender(apiKey!, fromAddress));
  return cached;
}
