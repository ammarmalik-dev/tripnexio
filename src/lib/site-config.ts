export const siteConfig = {
  name: "TripNexio",
  legalName: "TripNexio Travel Studio",
  tagline: "Visa & flight services for India to the UAE and GCC",
  description:
    "TripNexio helps travellers from India request visa and flight services for the UAE, Saudi Arabia, Bahrain, Kuwait, Oman and Qatar. Submit a request and our team handles it with vendors and airlines.",
  // TODO(client): confirm production domain before launch.
  url: "https://tripnexio.com",
  ogImage: "/og-image.png",
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
    facebook: "https://facebook.com/tripnexio",
    linkedin: "https://linkedin.com/company/tripnexio",
    x: "https://x.com/tripnexio",
    threads: "https://threads.net/@tripnexio",
  },
  nav: [
    { label: "New Visa", href: "/services/new-visa" },
    { label: "Visa Extension", href: "/services/visa-extension" },
    { label: "Visa Change", href: "/services/visa-change" },
    { label: "Flight Special Fare", href: "/services/flight-special-fare" },
    { label: "Track Status", href: "/track" },
  ],
} as const;

export type SiteConfig = typeof siteConfig;
