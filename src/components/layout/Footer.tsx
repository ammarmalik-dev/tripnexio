import Link from "next/link";
import { Logo } from "./Logo";
import { Container } from "@/components/ui/Container";
import { SocialIcon, type SocialPlatform } from "@/components/ui/SocialIcon";
import { siteConfig } from "@/lib/site-config";

const socialLinks: { platform: SocialPlatform; href: string; label: string }[] = [
  { platform: "instagram", href: siteConfig.socials.instagram, label: "Instagram" },
  { platform: "facebook", href: siteConfig.socials.facebook, label: "Facebook" },
  { platform: "linkedin", href: siteConfig.socials.linkedin, label: "LinkedIn" },
  { platform: "x", href: siteConfig.socials.x, label: "X" },
  { platform: "threads", href: siteConfig.socials.threads, label: "Threads" },
  { platform: "whatsapp", href: siteConfig.contact.whatsappHref, label: "WhatsApp" },
];

export function Footer() {
  return (
    <footer className="border-t border-hairline">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
          <Logo />
          <p className="max-w-xs text-sm text-ink-secondary">
            {siteConfig.tagline}.
          </p>
          <div className="flex items-center gap-3 pt-1">
            {socialLinks.map(({ platform, href, label }) => (
              <a
                key={platform}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-ink-secondary transition-colors duration-200 hover:border-glass-border hover:text-ink-primary"
              >
                <SocialIcon platform={platform} className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-ink-primary">Services</p>
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-ink-secondary transition-colors duration-200 hover:text-ink-primary"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-ink-primary">Company</p>
          <Link href="/about" className="text-sm text-ink-secondary transition-colors duration-200 hover:text-ink-primary">
            About TripNexio
          </Link>
          <Link href="/ai" className="text-sm text-ink-secondary transition-colors duration-200 hover:text-ink-primary">
            Ask TripNexio AI
          </Link>
          <Link href="/track" className="text-sm text-ink-secondary transition-colors duration-200 hover:text-ink-primary">
            Track Status
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-ink-primary">Contact</p>
          <p className="text-sm text-ink-tertiary">{siteConfig.contact.address}</p>
          <a
            href={siteConfig.contact.phoneHref}
            className="text-sm text-ink-tertiary transition-colors duration-200 hover:text-ink-primary"
          >
            {siteConfig.contact.phone}
          </a>
          <a
            href={siteConfig.contact.emailHref}
            className="text-sm text-ink-tertiary transition-colors duration-200 hover:text-ink-primary"
          >
            {siteConfig.contact.email}
          </a>
        </div>
      </Container>

      <div className="border-t border-hairline">
        <Container className="flex flex-col items-center justify-between gap-2 py-6 text-xs text-ink-muted sm:flex-row">
          <p>&copy; {new Date().getFullYear()} {siteConfig.legalName}. All rights reserved.</p>
          <p>India &rarr; UAE &middot; Saudi Arabia &middot; Bahrain &middot; Kuwait &middot; Oman &middot; Qatar</p>
        </Container>
      </div>
    </footer>
  );
}
