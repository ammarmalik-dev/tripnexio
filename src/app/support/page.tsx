import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, HelpCircle, MessageCircle, Search, Mail } from "lucide-react";
import { InfoPage } from "@/components/layout/InfoPage";

export const metadata: Metadata = {
  title: "Support",
  description: "TripNexio customer support — booking questions, document requirements, payment issues, status updates and service coordination.",
  alternates: { canonical: "/support" },
};

const options = [
  { icon: Search, title: "Track Status", body: "See the latest status of your enquiry, booking or service request.", href: "/track" },
  { icon: MessageCircle, title: "WhatsApp Support", body: "Chat with the TripNexio team on our official WhatsApp number.", href: "/whatsapp-support" },
  { icon: CreditCard, title: "Payment Support", body: "Help with a payment that failed, was debited twice or isn't reflected in your booking.", href: "/payment-support" },
  { icon: HelpCircle, title: "FAQ", body: "Answers to general platform questions.", href: "/faq" },
  { icon: Mail, title: "Contact", body: "Email, phone and the contact form.", href: "/contact" },
];

/** P20 — Company/Support/Legal doc §4 Support Overview (locked copy). */
export default function SupportPage() {
  return (
    <InfoPage
      eyebrow="Support"
      title="Support overview"
      description="TripNexio customer support is designed to help travellers with booking-related questions, document requirements, payment issues, status updates and service coordination."
    >
      <p className="text-sm text-ink-secondary">
        Customers should keep their Booking ID, reference number, registered mobile number or email address, and relevant payment/reference details available when contacting support.
      </p>
      <div className="rounded-xl border border-hairline bg-surface-2 p-5">
        <p className="text-sm font-semibold text-ink-heading">Support principle</p>
        <p className="mt-1 text-sm text-ink-secondary">
          Support can explain requirements and assist with the TripNexio process, but government, embassy, airline and third-party decisions remain outside TripNexio&apos;s control.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {options.map(({ icon: Icon, title, body, href }) => (
          <li key={title}>
            <Link
              href={href}
              className="flex h-full items-start gap-3 rounded-xl border border-hairline bg-surface-1 p-5 transition-colors duration-200 hover:border-glass-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-ink-heading">{title}</span>
                <span className="text-sm text-ink-secondary">{body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </InfoPage>
  );
}
