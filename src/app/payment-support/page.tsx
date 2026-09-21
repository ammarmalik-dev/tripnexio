import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Payment Support",
  description: "How payments work at TripNexio and where to get help with a payment.",
};

const steps = [
  {
    title: "Nothing is charged when you submit a request",
    body: "Our team reviews it first and sends you a quotation.",
  },
  {
    title: "You approve, then pay by secure link",
    body: "After you approve the quotation we send a secure payment link. Payments are processed by our payment provider; we don't see or store your card details.",
  },
  {
    title: "You get a confirmation and invoice",
    body: "Once the payment succeeds you receive a confirmation and your invoice, and your booking reference is created.",
  },
];

export default function PaymentSupportPage() {
  return (
    <InfoPage eyebrow="Help" title="Payment support" description="How paying with TripNexio works, and what to do if something goes wrong.">
      <ol className="flex flex-col gap-4">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
              {index + 1}
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold text-ink-heading">{step.title}</h2>
              <p className="text-sm text-ink-secondary">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-2 p-5">
        <h2 className="text-sm font-semibold text-ink-heading">Payment failed, expired or deducted twice?</h2>
        <p className="text-sm text-ink-secondary">
          Message us with your reference number and we&apos;ll check it. An expired payment link can be reissued by our
          team. For refunds, see our{" "}
          <a className="text-ink-accent underline" href="/legal/refund-policy">
            Refund &amp; Cancellation Policy
          </a>
          .
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={siteConfig.contact.whatsappHref}>WhatsApp Support</ButtonLink>
          <ButtonLink href={siteConfig.contact.emailHref} variant="glass">
            {siteConfig.contact.email}
          </ButtonLink>
        </div>
      </div>
    </InfoPage>
  );
}
