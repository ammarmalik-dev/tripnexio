import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "About Us",
  description: `About ${siteConfig.name} — visa and flight services for travellers from India to the UAE and Middle East.`,
};

export default function AboutPage() {
  return (
    <InfoPage eyebrow="About TripNexio" title="One company, one journey, connected services" description={siteConfig.tagline}>
      <div className="flex flex-col gap-4 text-sm leading-relaxed text-ink-secondary sm:text-base">
        <p>
          TripNexio is a connected travel-services platform run by {siteConfig.legalName} in {siteConfig.contact.address}.
          {" "}We help travellers from India with new visas, visa extensions, visa changes, special-fare flights, return
          verified tickets and OTB.
        </p>
        <p>
          You send us a request online. Our team then works with airlines, embassies and vendors on your behalf, sends
          you a clear quotation, and keeps you updated until your service is complete. It&apos;s a people-led service —
          there is no automatic instant booking, so every request is checked before anything is charged.
        </p>
        <p>
          Have a question at any point? Message us on WhatsApp or email {siteConfig.contact.email}.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/services">Browse Services</ButtonLink>
        <ButtonLink href={siteConfig.contact.whatsappHref} variant="glass">
          WhatsApp Support
        </ButtonLink>
      </div>
    </InfoPage>
  );
}
