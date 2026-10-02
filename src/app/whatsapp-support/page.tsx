import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { InfoPage } from "@/components/layout/InfoPage";
import { getSiteContact } from "@/lib/settings/system-config";

export const metadata: Metadata = {
  title: "WhatsApp Support",
  description: "Get TripNexio customer support on WhatsApp through the official number published on this website.",
  alternates: { canonical: "/whatsapp-support" },
};

// P20 — the number follows Admin → System Configuration.
export const revalidate = 300;

/** P20 — Company/Support/Legal doc §6 WhatsApp Support (locked copy). */
export default async function WhatsAppSupportPage() {
  const contact = await getSiteContact();
  const phone = contact.whatsapp;
  const href = contact.whatsappHref;

  return (
    <InfoPage
      eyebrow="Support"
      title="WhatsApp Support"
      description="TripNexio may provide customer support through WhatsApp using the official number published on the website."
    >
      <div className="flex flex-col items-start gap-3 rounded-xl border border-hairline bg-surface-1 p-6">
        <p className="text-sm text-ink-secondary">
          Official TripNexio WhatsApp: <strong className="text-ink-primary">{phone}</strong>
        </p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Chat on WhatsApp
        </a>
      </div>
      <p className="text-sm text-ink-secondary">
        Customers should use only the official TripNexio contact shown on the website or in their booking communication.
      </p>
      <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-5" role="note">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
        <p className="text-sm text-ink-secondary">
          Do not send card PINs, CVVs, banking passwords, account passwords or one-time passwords to support staff. TripNexio will request only information reasonably required to assist with the relevant service.
        </p>
      </div>
    </InfoPage>
  );
}
