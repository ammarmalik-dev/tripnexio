export interface NavLinkItem {
  label: string;
  href: string;
}

export const mainNav: NavLinkItem[] = [
  { label: "Services", href: "/services" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Track Status", href: "/track" },
  { label: "Contact", href: "/contact" },
];

export const utilityLinks = {
  trackStatus: { label: "Track Status", href: "/track" },
};

export const headerActions = {
  login: { label: "Login", href: "/login" },
  getStarted: { label: "Get Started", href: "/services" },
};

