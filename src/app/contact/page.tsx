import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { InfoPage } from "@/components/layout/InfoPage";
import { ContactForm } from "@/components/contact/ContactForm";
import { getSiteContact, getSystemConfig } from "@/lib/settings/system-config";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact TripNexio for service enquiries, booking assistance, payment issues and application updates.",
  alternates: { canonical: "/contact" },
};

// P20 — contact details come from Admin → System Configuration.
export const revalidate = 300;

/**
 * P20 — Company/Support/Legal doc §3. Support email, phone/WhatsApp and
 * address are Admin-editable (falling back to the published site contacts);
 * legal entity and GSTIN appear only once Admin has filled them in — never a
 * placeholder on the live site.
 */
export default async function ContactPage() {
  const site = await getSiteContact();
  const config = await getSystemConfig();
  const channels = [
    site.email ? { icon: Mail, label: "Customer Support Email", value: site.email, href: site.emailHref } : null,
    site.phone ? { icon: Phone, label: "Customer Support Phone", value: site.phone, href: site.phoneHref } : null,
    site.whatsapp ? { icon: MessageCircle, label: "WhatsApp", value: site.whatsapp, href: site.whatsappHref } : null,
    site.address ? { icon: MapPin, label: "Registered Office Address", value: site.address, href: null } : null,
  ].filter((channel) => channel !== null);
  const legal = [
    config.legalEntityName ? { label: "Business / Legal Entity Name", value: config.legalEntityName } : null,
    config.gstin ? { label: "GSTIN", value: config.gstin } : null,
  ].filter((item) => item !== null);

  return (
    <InfoPage
      eyebrow="Company"
      title="Contact"
      description="For service enquiries, booking assistance, payment issues, application updates and other customer support, use the support channels below."
      narrow={false}
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-3">
            {channels.map(({ icon: Icon, label, value, href }) => (
              <li key={label} className="flex items-start gap-3 rounded-xl border border-hairline bg-surface-1 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-ink-tertiary">{label}</span>
                  {href ? (
                    <a
                      href={href}
                      className="text-sm font-medium text-ink-primary hover:text-ink-accent"
                      {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                      {value}
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-ink-primary">{value}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {legal.length > 0 ? (
            <dl className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-4 text-sm">
              {legal.map((item) => (
                <div key={item.label} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-ink-tertiary">{item.label}</dt>
                  <dd className="font-medium text-ink-primary">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <p className="text-xs text-ink-tertiary">
            Keep your Booking ID or reference number, registered mobile number or email handy when you contact us.
          </p>
        </div>
        <ContactForm />
      </div>
    </InfoPage>
  );
}
