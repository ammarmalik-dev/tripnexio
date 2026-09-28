import Link from "next/link";
import { Logo } from "./Logo";
import { Container } from "@/components/ui/Container";
import { SocialIcon, type SocialPlatform } from "@/components/ui/SocialIcon";
import { siteConfig } from "@/lib/site-config";
import { utilityLinks } from "@/lib/nav-config";
import { getActiveServices } from "@/lib/services/active-services";
import { getSystemConfig } from "@/lib/settings/system-config";
import { SERVICE_ROUTE_INFO } from "@/lib/service-route-info";

const socialLinks: { platform: SocialPlatform; href: string; label: string }[] = [
  { platform: "instagram", href: siteConfig.socials.instagram, label: "Instagram" },
  { platform: "facebook", href: siteConfig.socials.facebook, label: "Facebook" },
  { platform: "linkedin", href: siteConfig.socials.linkedin, label: "LinkedIn" },
  { platform: "x", href: siteConfig.socials.x, label: "X" },
  { platform: "threads", href: siteConfig.socials.threads, label: "Threads" },
  { platform: "whatsapp", href: siteConfig.contact.whatsappHref, label: "WhatsApp" },
];

// Locked footer structure — Homepage_FINAL_Locked_1of1.docx §11: Careers removed, Blog kept.
const companyLinks = [
  { label: "About Us", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/#support" },
];

const supportLinks = [
  { label: "Track Status", href: utilityLinks.trackStatus.href },
  { label: "WhatsApp Support", href: siteConfig.contact.whatsappHref },
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

/**
 * Same active Service rows as the homepage grid, so an Admin rename/reorder/
 * disable shows up in both. A DB hiccup renders an empty column rather than
 * failing every page (the root layout renders this on every route).
 */
async function loadServiceLinks(): Promise<{ label: string; href: string }[]> {
  try {
    const rows = await getActiveServices();
    return rows.flatMap((row) => {
      const routeInfo = SERVICE_ROUTE_INFO[row.code];
      return routeInfo ? [{ label: row.name, href: routeInfo.href }] : [];
    });
  } catch (error) {
    console.error("[Footer] couldn't load services", error);
    return [];
  }
}

export async function Footer() {
  // Sequential on purpose — the root layout renders this on every page.
  const config = await getSystemConfig();
  const serviceLinks = await loadServiceLinks();
  const companyName = config.companyName?.trim();
  const companyPhone = config.companyPhone?.trim();
  const companyEmail = config.companyEmail?.trim();

  return (
    <footer className="surface-dark-block">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
          <Logo variant="onDark" />
          <p className="max-w-xs text-sm text-ink-on-dark-secondary">{siteConfig.tagline}</p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {socialLinks.map(({ platform, href, label }) => (
              <a
                key={platform}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline-on-dark text-ink-on-dark-secondary transition-colors duration-200 hover:border-white/30 hover:text-ink-on-dark-primary"
              >
                <SocialIcon platform={platform} className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <FooterColumn title="Company" links={companyLinks} />
        <FooterColumn title="Services" links={serviceLinks} />
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
          {companyPhone || companyEmail ? (
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {companyPhone ? (
                <a href={`tel:${companyPhone.replace(/\s+/g, "")}`} className="hover:text-ink-on-dark-primary">
                  {companyPhone}
                </a>
              ) : null}
              {companyEmail ? (
                <a href={`mailto:${companyEmail}`} className="hover:text-ink-on-dark-primary">
                  {companyEmail}
                </a>
              ) : null}
            </p>
          ) : null}
        </Container>
      </div>
    </footer>
  );
}
