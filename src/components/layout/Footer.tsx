import Link from "next/link";
import { Logo } from "./Logo";
import { Container } from "@/components/ui/Container";
import { SocialIcon, type SocialPlatform } from "@/components/ui/SocialIcon";
import { siteConfig } from "@/lib/site-config";
import { utilityLinks } from "@/lib/nav-config";
import { services } from "@/lib/services-config";

const socialLinks: { platform: SocialPlatform; href: string; label: string }[] = [
  { platform: "instagram", href: siteConfig.socials.instagram, label: "Instagram" },
  { platform: "facebook", href: siteConfig.socials.facebook, label: "Facebook" },
  { platform: "linkedin", href: siteConfig.socials.linkedin, label: "LinkedIn" },
  { platform: "x", href: siteConfig.socials.x, label: "X" },
  { platform: "threads", href: siteConfig.socials.threads, label: "Threads" },
  { platform: "whatsapp", href: siteConfig.contact.whatsappHref, label: "WhatsApp" },
];

const companyLinks = [
  { label: "About Us", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/#support" },
  { label: "Careers", href: "/careers" },
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

export function Footer() {
  return (
    <footer className="surface-dark-block">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
          <Logo variant="onDark" />
          <p className="max-w-xs text-sm text-ink-on-dark-secondary">{siteConfig.tagline}.</p>
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
        <FooterColumn
          title="Services"
          links={services.map((service) => ({ label: service.title, href: service.href }))}
        />
        <FooterColumn title="Support" links={supportLinks} />
        <FooterColumn title="Legal" links={legalLinks} />
      </Container>

      <div className="border-t border-hairline-on-dark">
        <Container className="flex flex-col items-center justify-between gap-2 py-6 text-xs text-ink-on-dark-muted sm:flex-row">
          <p>
            &copy; {new Date().getFullYear()} {siteConfig.legalName}. All rights reserved.
          </p>
          <p>India &rarr; UAE &middot; Saudi Arabia &middot; Bahrain &middot; Kuwait &middot; Oman &middot; Qatar</p>
        </Container>
      </div>
    </footer>
  );
}
