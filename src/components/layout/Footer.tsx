import Link from "next/link";
import { Logo } from "./Logo";
import { Container } from "@/components/ui/Container";
import { SocialIcon, SOCIAL_HOVER_CLASS } from "@/components/ui/SocialIcon";
import { utilityLinks } from "@/lib/nav-config";
import { getSiteContact, getSystemConfig } from "@/lib/settings/system-config";
import { socialLinksFor } from "@/lib/site-contact";
import { getActiveServices } from "@/lib/services/active-services";
import { SERVICE_ROUTE_INFO } from "@/lib/service-route-info";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import type { ServiceType } from "../../generated/prisma/enums";
import { CookieSettingsLink } from "@/components/cookies/CookieConsent";

// Locked footer structure — Homepage_FINAL_Locked_1of1.docx §11: Careers removed, Blog kept.
const companyLinks = [
  { label: "About Us", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

const supportLinks = [
  { label: "Track Status", href: utilityLinks.trackStatus.href },
  { label: "WhatsApp Support", href: "/whatsapp-support" },
  { label: "FAQ", href: "/faq" },
  { label: "Payment Support", href: "/payment-support" },
];

const legalLinks = [
  { label: "Terms & Conditions", href: "/legal/terms" },
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Refund & Cancellation Policy", href: "/legal/refund-policy" },
  { label: "Cookie Policy", href: "/legal/cookie-policy" },
  { label: "Disclaimer", href: "/legal/disclaimer" },
  { label: "Grievance Redressal", href: "/legal/grievance-redressal" },
];

/**
 * Services column (client request 2026-10-03, replacing the earlier "no
 * Services column" rule): every active service from Admin → Services in its
 * display order, so a renamed/disabled service updates here too. Falls back
 * to all six services if the database is unreachable.
 */
async function loadServiceLinks(): Promise<{ label: string; href: string }[]> {
  try {
    const services = await getActiveServices();
    return services.flatMap((service) => {
      const route = SERVICE_ROUTE_INFO[service.code];
      return route ? [{ label: service.name, href: route.href }] : [];
    });
  } catch (error) {
    console.error("[footer] couldn't load services", error);
    return Object.entries(SERVICE_ROUTE_INFO).map(([code, route]) => ({ label: SERVICE_TYPE_LABELS[code as ServiceType] ?? code, href: route.href }));
  }
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-ink-on-dark-primary">{title}</p>
      {links.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          className="text-sm text-ink-on-dark-secondary transition-colors duration-200 hover:text-ink-on-dark-primary"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

export async function Footer() {
  const config = await getSystemConfig();
  const contact = await getSiteContact();
  const serviceLinks = await loadServiceLinks();
  const companyName = config.companyName?.trim();
  const companyPhone = config.companyPhone?.trim();
  const companyEmail = config.companyEmail?.trim();

  return (
    <footer className="surface-dark-block">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
          <Logo variant="onDark" />
          <p className="max-w-xs text-sm text-ink-on-dark-secondary">{contact.tagline}</p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {socialLinksFor(contact).map(({ platform, href, label }) => (
              <a
                key={platform}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className={`flex h-9 w-9 items-center justify-center rounded-full border border-hairline-on-dark text-ink-on-dark-secondary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${SOCIAL_HOVER_CLASS[platform]}`}
              >
                <SocialIcon platform={platform} className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <FooterColumn title="Services" links={serviceLinks} />
        <FooterColumn title="Company" links={companyLinks} />
        <FooterColumn title="Support" links={supportLinks} />
        <FooterColumn title="Legal" links={legalLinks} />
      </Container>

      <div className="border-t border-hairline-on-dark">
        <Container className="flex flex-col items-center justify-between gap-2 py-6 text-xs text-ink-on-dark-muted sm:flex-row">
          {companyName ? (
            <p>
              &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
            </p>
          ) : null}
          <CookieSettingsLink className="hover:text-ink-on-dark-primary focus-visible:outline-none focus-visible:underline" />
          {companyPhone || companyEmail ? (
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {companyPhone ? (
                <a href={contact.phoneHref} className="hover:text-ink-on-dark-primary">
                  {contact.phone}
                </a>
              ) : null}
              {companyEmail ? (
                <a href={contact.emailHref} className="hover:text-ink-on-dark-primary">
                  {contact.email}
                </a>
              ) : null}
            </p>
          ) : null}
        </Container>
      </div>
    </footer>
  );
}
