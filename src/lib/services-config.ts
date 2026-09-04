import {
  FileText,
  CalendarClock,
  ArrowLeftRight,
  Plane,
  TicketCheck,
  PlaneTakeoff,
  type LucideIcon,
} from "lucide-react";

export interface ServiceModule {
  key: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  image: string;
  imageAlt: string;
}

/**
 * Photography sourced from Unsplash (free to use under the Unsplash License,
 * no attribution required) — placeholder-quality stock shots to get the
 * premium look in place now; swap for TripNexio's own branded photography
 * when the client provides it.
 */
export const services: ServiceModule[] = [
  {
    key: "new-visa",
    title: "New Visa",
    description: "Apply for a new UAE or GCC visa with our simple, guided process.",
    href: "/services/new-visa",
    icon: FileText,
    image:
      "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "A commercial aircraft parked at an airport terminal gate",
  },
  {
    key: "visa-extension",
    title: "Visa Extension",
    description: "Extend an existing visa originally issued through TripNexio.",
    href: "/services/visa-extension",
    icon: CalendarClock,
    image:
      "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "A flat lay of travel planning essentials — map, notebook and camera",
  },
  {
    key: "visa-change",
    title: "Visa Change",
    description: "Change or exit your visa status — airport-to-airport or border exit.",
    href: "/services/visa-change",
    icon: ArrowLeftRight,
    image:
      "https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "View of an airplane wing above clouds at sunset",
  },
  {
    key: "flight-special-fare",
    title: "Special Fare Flight",
    description: "Official special fare flight bookings through our airline and vendor partners.",
    href: "/services/flight-special-fare",
    icon: Plane,
    image:
      "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "View of an airplane wing above clouds, backlit by the sun",
  },
  {
    key: "return-verified-ticket",
    title: "Return Verified Ticket",
    description: "A verified return ticket for use with your visa application.",
    href: "/services/return-verified-ticket",
    icon: TicketCheck,
    image:
      "https://images.unsplash.com/photo-1540339832862-474599807836?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Interior of an airplane cabin with passengers seated",
  },
  {
    key: "otb",
    title: "OTB — Ok to Board",
    description: "Airline Ok-to-Board authorization arranged for your departure.",
    href: "/services/otb",
    icon: PlaneTakeoff,
    image:
      "https://images.unsplash.com/photo-1533387520709-752d83de3630?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Sunset over layered mountain ridges with a jet contrail overhead",
  },
];
