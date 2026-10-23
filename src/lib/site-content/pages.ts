/**
 * Client doc 2026-10-15 (J3) — the website pages whose photo and main wording Admin edits (Admin → Website
 * Pages). Plain data (no DB) so the Admin editor and the pages share it. Each field's `fallback` is the
 * page's original locked copy: a blank field in Admin shows it, so nothing changes until Admin edits it.
 * New Visa country pages have their own, fuller editor (Admin → New Visa Countries).
 */
export const SITE_PAGES = ["home", "visa-change", "visa-extension", "otb", "flight-special-fare", "return-ticket"] as const;
export type SitePage = (typeof SITE_PAGES)[number];

export type SitePageField = "heroEyebrow" | "heroBadge" | "heroTitle" | "heroSubtitle" | "heroTagline" | "applyLabel" | "steps" | "ctaHeading";

export interface SitePageFieldDef {
  key: SitePageField;
  label: string;
  multiline?: boolean;
  hint?: string;
  fallback: string;
}

export interface SitePageDef {
  label: string;
  path: string;
  /** The built-in photo used while no photo is uploaded. */
  defaultImage: string;
  fields: SitePageFieldDef[];
}

const STEPS_HINT = 'Four lines, each "Title | description". Blank = the standard steps.';

const steps = (lines: [string, string][]): string => lines.map(([title, description]) => `${title} | ${description}`).join("\n");

const serviceFields = (input: {
  eyebrow: string;
  badge?: string;
  title: string;
  subtitle: string;
  tagline?: string;
  applyLabel: string;
  steps: [string, string][];
  ctaHeading: string;
}): SitePageFieldDef[] => [
  { key: "heroEyebrow", label: "Small heading above the title", fallback: input.eyebrow },
  ...(input.badge !== undefined ? [{ key: "heroBadge" as const, label: "Badge", fallback: input.badge }] : []),
  { key: "heroTitle", label: "Title", fallback: input.title },
  { key: "heroSubtitle", label: "Intro text", multiline: true, fallback: input.subtitle },
  ...(input.tagline !== undefined ? [{ key: "heroTagline" as const, label: "Highlights line", fallback: input.tagline }] : []),
  { key: "applyLabel", label: "Apply button", fallback: input.applyLabel },
  { key: "steps", label: "How It Works steps", multiline: true, hint: STEPS_HINT, fallback: steps(input.steps) },
  { key: "ctaHeading", label: "Closing banner heading", fallback: input.ctaHeading },
];

export const SITE_PAGE_DEFS: Record<SitePage, SitePageDef> = {
  home: {
    label: "Home",
    path: "/",
    defaultImage: "/images/hero/home.jpg",
    fields: [
      { key: "heroEyebrow", label: "Small heading above the title", fallback: "Visa · Flights · OTB" },
      { key: "heroTitle", label: "Title", hint: '"TripNexio" in the title is highlighted.', fallback: "Travel Made Easy with TripNexio" },
      { key: "heroSubtitle", label: "Intro text (optional)", multiline: true, fallback: "" },
      { key: "applyLabel", label: "Main button", fallback: "Explore Services" },
    ],
  },
  "visa-change": {
    label: "Visa Change",
    path: "/services/visa-change",
    defaultImage: "/images/services/visa-change.jpg",
    fields: serviceFields({
      eyebrow: "UAE Visa Change",
      title: "Visa Change, Made Simple",
      subtitle:
        "Change your UAE visa from inside the UAE through a simple, guided process. Choose Airport-to-Airport or Border Exit, submit your details, and let TripNexio coordinate the next steps for you.",
      applyLabel: "Start Visa Change",
      steps: [
        ["Start Your Application", "Choose A2A or Border Exit and enter your traveller details."],
        ["We Check & Confirm Availability", "Our team checks availability and shares the available option."],
        ["Choose Your Option & Pay", "Select your confirmed date, time and package, then review and complete payment."],
        ["We Complete Your Visa Change", "Follow the exit instructions. After exit completion, the new visa process starts and the approved visa is delivered."],
      ],
      ctaHeading: "Ready to change your visa?",
    }),
  },
  "visa-extension": {
    label: "Visa Extension",
    path: "/services/visa-extension",
    defaultImage: "/images/services/visa-extension.jpg",
    fields: serviceFields({
      eyebrow: "UAE Visa Extension",
      title: "Extend Your UAE Visa",
      subtitle:
        "Extend an existing UAE visa originally issued through TripNexio. Submit your details online — our team verifies your visa and handles the extension process from there.",
      applyLabel: "Apply for Visa Extension",
      steps: [
        ["Start Your Extension Request", "Enter your name, mobile number, email address, passport number and visa expiry date."],
        ["We Verify Your Visa & Documents", "Our team checks your TripNexio-issued visa, actual expiry and required documents for eligibility."],
        ["Review & Pay", "Once verification is complete, review the quotation and complete payment."],
        ["Receive Your Extended Visa", "We process the extension and send the extended visa copy by WhatsApp and email."],
      ],
      ctaHeading: "Need more time in the UAE?",
    }),
  },
  otb: {
    label: "OTB",
    path: "/services/otb",
    defaultImage: "/images/services/otb.jpg",
    fields: serviceFields({
      eyebrow: "OK to Board",
      badge: "Official OTB Partner",
      title: "OK to Board, Made Simple",
      subtitle:
        "Travelling from India with an ECR passport? Get your OTB arranged before your flight and travel with greater peace of mind. TripNexio coordinates the OTB process with the relevant airline and keeps you updated until completion.",
      tagline: "India-Based Processing · Airline-Specific Timelines · Status Updates",
      applyLabel: "Apply for OTB",
      steps: [
        ["Share Your Flight Details", "Enter your airline, travel date and contact details."],
        ["Submit Your Documents & Pay", "Provide the required documents, review the applicable service details and complete payment."],
        ["We Process Your OTB", "TripNexio coordinates the request through the relevant airline/process channel."],
        ["Get Your OTB Confirmation", "Once the airline confirms the OTB, we share the confirmation/reference with you and update your status via WhatsApp and email."],
      ],
      ctaHeading: "Ready to request your OTB?",
    }),
  },
  "flight-special-fare": {
    label: "Flight Special Fare",
    path: "/services/flight-special-fare",
    defaultImage: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80",
    fields: serviceFields({
      eyebrow: "Flight Special Fare",
      title: "Special Fares, Made Simple",
      subtitle:
        "Offline special fares sourced through our airline and partners for major domestic cities in India and destinations worldwide. Share your route, travel date and passenger details — our team checks available airline and agency inventory and sends you the best available options.",
      applyLabel: "Request a Fare Quote",
      steps: [
        ["Share Your Trip Details", "Tell us your departure, destination, travel date and passenger details."],
        ["We Check & Share Available Fares", "Our team checks available fares and sends you flight options with airline, timings, baggage and fare details."],
        ["Choose Your Fare & Pay", "Select your preferred option while the quotation is valid and complete payment."],
        ["We Reconfirm & Issue Your Ticket", "After payment, we reconfirm final availability. Once confirmed, your ticket is issued and delivered."],
      ],
      ctaHeading: "Ready to check special fares for your trip?",
    }),
  },
  "return-ticket": {
    label: "Return Ticket",
    path: "/services/return-ticket",
    defaultImage: "/images/services/return-ticket.jpg",
    fields: serviceFields({
      eyebrow: "International Return Ticket",
      title: "Return Ticket, Made Simple",
      subtitle: "Get a verifiable return ticket reservation for international travel. Share your destination and travel date — we take care of the rest.",
      applyLabel: "Reserve Your Ticket",
      steps: [
        ["Share Your Travel Details", "Enter your destination, passenger count and travel date."],
        ["Review Your Booking & Pay", "Check the return date, applicable price and terms, then complete payment."],
        [
          "We Arrange Your Return Ticket",
          "After payment, our team processes the reservation through the configured airline/partner process and completes the required verification.",
        ],
        ["Receive Your Ticket", "Once issued, your return ticket is delivered to you."],
      ],
      ctaHeading: "Ready to reserve your return ticket?",
    }),
  },
};

export function isSitePage(value: string): value is SitePage {
  return (SITE_PAGES as readonly string[]).includes(value);
}

/** "Title | description" lines → steps (fewer than one valid line = null, so the page keeps its own). */
export function parseStepLines(text: string): { headline: string; supportingCopy: string }[] | null {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.split("|").map((part) => part.trim()))
    .filter((parts) => parts[0])
    .map((parts) => ({ headline: parts[0], supportingCopy: parts.slice(1).join(" | ") }));
  return rows.length > 0 ? rows : null;
}
