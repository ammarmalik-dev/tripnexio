import {
  FileText,
  CalendarClock,
  ArrowLeftRight,
  Plane,
  TicketCheck,
  type LucideIcon,
} from "lucide-react";

export interface NavSubItem {
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
}

export interface NavDropdownItem {
  type: "dropdown";
  label: string;
  items: NavSubItem[];
}

export interface NavLinkItem {
  type: "link";
  label: string;
  href: string;
}

export type MainNavItem = NavDropdownItem | NavLinkItem;

export const mainNav: MainNavItem[] = [
  {
    type: "dropdown",
    label: "UAE Visa",
    items: [
      {
        label: "New Visa",
        href: "/services/new-visa",
        description: "Apply for a new UAE or GCC visa request.",
        icon: FileText,
      },
      {
        label: "Visa Extension",
        href: "/services/visa-extension",
        description: "Extend an existing visa before it expires.",
        icon: CalendarClock,
      },
      {
        label: "Visa Change",
        href: "/services/visa-change",
        description: "Airport-to-airport or border exit visa change.",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    type: "dropdown",
    label: "Flights",
    items: [
      {
        label: "Flight Special Fare",
        href: "/services/flight-special-fare",
        description: "Special fares for visa and travel bookings.",
        icon: Plane,
      },
      {
        label: "Return Verified Ticket",
        href: "/services/return-verified-ticket",
        description: "A verified return ticket for visa applications.",
        icon: TicketCheck,
      },
    ],
  },
  {
    type: "link",
    label: "OTB",
    href: "/services/otb",
  },
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
