import { siteConfig } from "./site-config";

/**
 * Public contact details shown across the website (navbar, menu, footer,
 * support pages, checkout). Built on the server from Admin → System
 * Configuration (with site-config.ts as the fallback) and handed to client
 * components through SiteContactProvider. Plain data only, safe to send to
 * the browser.
 */
export interface SiteContact {
  name: string;
  legalName: string;
  tagline: string;
  address: string;
  phone: string;
  phoneHref: string;
  email: string;
  emailHref: string;
  whatsapp: string;
  whatsappHref: string;
  socials: { instagram: string; facebook: string; linkedin: string; x: string; threads: string };
}

export function phoneHrefFor(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function whatsappHrefFor(number: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}`;
}

export type SocialLinkPlatform = "instagram" | "facebook" | "linkedin" | "x" | "threads" | "whatsapp";

/** The social icons row (footer and mobile menu), in display order. */
export function socialLinksFor(contact: SiteContact): { platform: SocialLinkPlatform; href: string; label: string }[] {
  return [
    { platform: "instagram", href: contact.socials.instagram, label: "Instagram" },
    { platform: "facebook", href: contact.socials.facebook, label: "Facebook" },
    { platform: "linkedin", href: contact.socials.linkedin, label: "LinkedIn" },
    { platform: "x", href: contact.socials.x, label: "X" },
    { platform: "threads", href: contact.socials.threads, label: "Threads" },
    { platform: "whatsapp", href: contact.whatsappHref, label: "WhatsApp" },
  ];
}

/** The static defaults from site-config.ts (used when nothing is set in Admin, and as the client fallback). */
export const STATIC_SITE_CONTACT: SiteContact = {
  name: siteConfig.name,
  legalName: siteConfig.legalName,
  tagline: siteConfig.tagline,
  address: siteConfig.contact.address,
  phone: siteConfig.contact.phone,
  phoneHref: siteConfig.contact.phoneHref,
  email: siteConfig.contact.email,
  emailHref: siteConfig.contact.emailHref,
  whatsapp: siteConfig.contact.phone,
  whatsappHref: siteConfig.contact.whatsappHref,
  socials: { ...siteConfig.socials },
};
