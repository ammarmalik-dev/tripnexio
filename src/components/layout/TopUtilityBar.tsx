import Link from "next/link";
import { Phone, Mail } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SocialIcon, type SocialPlatform } from "@/components/ui/SocialIcon";
import { siteConfig } from "@/lib/site-config";
import { utilityLinks, headerContact } from "@/lib/nav-config";

const socialLinks: { platform: SocialPlatform; href: string; label: string }[] = [
  { platform: "instagram", href: siteConfig.socials.instagram, label: "Instagram" },
  { platform: "facebook", href: siteConfig.socials.facebook, label: "Facebook" },
  { platform: "linkedin", href: siteConfig.socials.linkedin, label: "LinkedIn" },
  { platform: "x", href: siteConfig.socials.x, label: "X" },
  { platform: "threads", href: siteConfig.socials.threads, label: "Threads" },
];

export function TopUtilityBar() {
  return (
    <div className="hidden bg-accent-dark lg:block">
      <Container className="flex h-9 items-center justify-between text-xs text-ink-tertiary">
        <div className="flex items-center gap-5">
          <a
            href={headerContact.phoneHref}
            className="flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-secondary"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            {headerContact.phoneDisplay}
          </a>
          <a
            href={headerContact.emailHref}
            className="flex items-center gap-1.5 transition-colors duration-200 hover:text-ink-secondary"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            {headerContact.emailDisplay}
          </a>
        </div>

        <div className="flex items-center gap-5">
          <Link
            href={utilityLinks.trackStatus.href}
            className="transition-colors duration-200 hover:text-ink-secondary"
          >
            {utilityLinks.trackStatus.label}
          </Link>
          <Link
            href={utilityLinks.askAi.href}
            className="transition-colors duration-200 hover:text-ink-secondary"
          >
            {utilityLinks.askAi.label}
          </Link>
          <div className="flex items-center gap-3 border-l border-hairline pl-5">
            {socialLinks.map(({ platform, href, label }) => (
              <a
                key={platform}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="text-ink-tertiary transition-colors duration-200 hover:text-ink-secondary"
              >
                <SocialIcon platform={platform} className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
