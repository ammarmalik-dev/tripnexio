import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { getSiteContact } from "@/lib/settings/system-config";

export const metadata: Metadata = {
  title: "Payment Support",
  description: "How payments work at TripNexio and where to get help with a payment.",
};

// Client copy, corrections document 2026-10-05 ("Payment Support").
const detailsToShare = [
  "Booking ID or reference ID",
  "Payment date and time",
  "Amount",
  "Payment method",
  "Payment gateway transaction / reference number, where available",
];

const paymentIssues = [
  "Payment debited but not reflected in the booking",
  "Failed or reversed payment",
  "Duplicate payment",
  "Invoice mismatch",
  "Refund-status query",
  "Other checkout issue",
];

// Contact details follow Admin → System Configuration.
export const revalidate = 300;

export default async function PaymentSupportPage() {
  const contact = await getSiteContact();
  return (
    <InfoPage eyebrow="Help" title="Payment support" description="How paying with TripNexio works, and what to do if something goes wrong.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
          <h2 className="text-sm font-semibold text-ink-heading">What to share with us</h2>
          <p className="text-sm text-ink-secondary">For a payment issue, contact support with:</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-secondary">
            {detailsToShare.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
          <h2 className="text-sm font-semibold text-ink-heading">Payment issues we can help with</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-secondary">
            {paymentIssues.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
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
          <ButtonLink href={contact.whatsappHref}>WhatsApp Support</ButtonLink>
          <ButtonLink href={contact.emailHref} variant="glass">
            {contact.email}
          </ButtonLink>
        </div>
      </div>
      <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-ink-primary">
        Never share card PINs, CVVs, passwords or OTPs with TripNexio support. Payment processing may involve a
        third-party payment gateway, bank or card network, and resolution timing may depend on that provider.
      </p>
    </InfoPage>
  );
}
