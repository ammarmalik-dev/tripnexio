import type { EmailSender, SendEmailInput, SendEmailResult } from "./sender";
import { ResendEmailSender } from "./resend-sender";
import { ConsoleEmailSender } from "./console-sender";
import { defaultEmailFooter, SUPPORT_EMAIL } from "./footer";
import { renderEmailLayout } from "./layout";
import { siteConfig } from "@/lib/site-config";
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
class BrandedEmailSender implements EmailSender {
  readonly providerName: string;

  constructor(private readonly inner: EmailSender) {
    this.providerName = inner.providerName;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    let footer: string;
    let contact: { name: string; phone: string; address: string } = { name: siteConfig.name, phone: siteConfig.contact.phone, address: siteConfig.contact.address };
    try {
      const config = await getSystemConfig();
      const siteContact = await getSiteContact();
      contact = { name: siteContact.name, phone: siteContact.phone, address: siteContact.address };
      footer = config.emailFooterText?.trim() ? config.emailFooterText : defaultEmailFooter(siteContact.phone);
    } catch {
      footer = defaultEmailFooter(contact.phone);
    }
    const html = renderEmailLayout({
      bodyHtml: input.html,
      hero: input.hero,
      footerText: footer,
      siteUrl: siteConfig.url,
      companyName: contact.name,
      tagline: "Travel Made Easy with TripNexio.",
      phone: contact.phone,
      supportEmail: SUPPORT_EMAIL,
      address: contact.address,
    });
    return this.inner.send({ ...input, html });
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

  cached = new BrandedEmailSender(isPlaceholder(apiKey) ? new ConsoleEmailSender() : new ResendEmailSender(apiKey!, fromAddress));
  return cached;
}
