export const siteConfig = {
  name: "TripNexio",
  legalName: "TripNexio Travel Studio",
  // Worldwide positioning (client-locked, Homepage_FINAL_Locked_1of1.docx §1/§11)
  // — do not reintroduce UAE/GCC-only wording here.
  tagline: "Travel Made Easy with TripNexio.",
  description:
    "TripNexio brings visa and travel services together in one simple experience. Submit a request and our team handles it with airlines and partners, from start to finish.",
  // TODO(client): confirm production domain before launch.
  url: "https://tripnexio.com",
  // Client testing 2026-10-09 (B4) — new file name so WhatsApp/SMS previews drop the cached old image.
  ogImage: "/og-image-2026.jpg",
  contact: {
    address: "Mumbai, India",
    phone: "+91 92381 84005",
    phoneHref: "tel:+919238184005",
    email: "info@tripnexio.com",
    emailHref: "mailto:info@tripnexio.com",
    // Permanent WhatsApp click-to-chat link (wa.me), built from the real
    // number above rather than a pasted Facebook Page CTA link — those carry
    // a session/token-bound URL (exp claim + fbclid tracking param) that
    // isn't meant to be embedded permanently on the site.
    whatsappHref: "https://wa.me/919238184005",
  },
  socials: {
    instagram: "https://instagram.com/tripnexio",
    facebook: "https://www.facebook.com/people/TripNexio/61592777304578/",
    linkedin: "https://linkedin.com/company/tripnexio",
    x: "https://x.com/tripnexio",
    threads: "https://threads.net/@tripnexio",
  },
} as const;

export type SiteConfig = typeof siteConfig;
