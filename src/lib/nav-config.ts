export interface NavLinkItem {
  label: string;
  href: string;
}

export const mainNav: NavLinkItem[] = [
  { label: "Services", href: "/services" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Track Status", href: "/track" },
  { label: "Contact", href: "/#support" },
];

export const utilityLinks = {
  trackStatus: { label: "Track Status", href: "/track" },
  askAi: { label: "Ask TripNexio AI", href: "/ai" },
};

export const headerActions = {
  login: { label: "Login", href: "/login" },
  getStarted: { label: "Get Started", href: "/services" },
};

export const headerContact = {
  phoneDisplay: "+91 92381 84005",
  phoneHref: "tel:+919238184005",
  emailDisplay: "info@tripnexio.com",
  emailHref: "mailto:info@tripnexio.com",
};
