import { listLines, type SiteSection } from "../section-types";

/** Client confirmation 2026-10-25 — the editable sections of the Home page, top to bottom (below the hero). */
export const HOME_SECTIONS: SiteSection[] = [
  {
    id: "heroButtons",
    label: "Hero — second button",
    fields: [{ key: "heroButtons.trackLabel", label: "Track Status button", kind: "text", fallback: "Track Status" }],
  },
  {
    id: "services",
    label: "Explore Our Services (the cards come from Admin → Services)",
    fields: [
      { key: "services.eyebrow", label: "Small heading", kind: "text", fallback: "Everything TripNexio offers" },
      { key: "services.title", label: "Heading", kind: "text", fallback: "Explore Our Services" },
      {
        key: "services.intro",
        label: "Intro text",
        kind: "multiline",
        fallback: "Visa and travel services made simple, with a clear process and guided support from start to finish.",
      },
      { key: "services.linkLabel", label: "Link label", kind: "text", fallback: "View All Services" },
    ],
  },
  {
    id: "howItWorks",
    label: "How TripNexio Works",
    fields: [
      { key: "howItWorks.eyebrow", label: "Small heading", kind: "text", fallback: "Simple steps. Clear support." },
      { key: "howItWorks.title", label: "Heading", kind: "text", fallback: "How TripNexio Works" },
      {
        key: "howItWorks.steps",
        label: "Steps",
        kind: "list",
        hint: 'One step per line: "Title | description". Steps are numbered automatically.',
        fallback: listLines([
          ["Tell Us", "Choose your service and share your basic details."],
          ["We Check", "We review your details, documents and available options."],
          ["Confirm & Pay", "Review your option or quotation and complete payment securely."],
          ["We Process", "Our team handles the next steps and keeps you updated."],
          ["Get Your Result", "Receive your visa, ticket, OTB or service update."],
        ]),
      },
    ],
  },
  {
    id: "track",
    label: "Track your journey (dark card)",
    fields: [
      { key: "track.title", label: "Heading", kind: "text", fallback: "Track your journey" },
      { key: "track.intro", label: "Intro text", kind: "multiline", fallback: "Track your application, documents and status updates in one place." },
      { key: "track.buttonLabel", label: "Button", kind: "text", fallback: "Track Your Application" },
      {
        key: "track.stages",
        label: "Sample stages",
        kind: "list",
        hint: 'One stage per line: "Label | done / current / upcoming" (how the stage is drawn).',
        fallback: listLines([
          ["Application Received", "done"],
          ["Documents Validated", "done"],
          ["Submitted for Processing", "current"],
          ["Under Review", "upcoming"],
          ["Completed", "upcoming"],
        ]),
      },
    ],
  },
  {
    id: "why",
    label: "Why Choose Us",
    fields: [
      { key: "why.eyebrow", label: "Small heading", kind: "text", fallback: "Why TripNexio" },
      { key: "why.title", label: "Heading", kind: "text", fallback: "A Simpler Way to Travel" },
      {
        key: "why.cards",
        label: "Reasons",
        kind: "list",
        hint: 'One reason per line: "Title | description".',
        fallback: listLines([
          ["Simple Process", "Easy steps from request to completion."],
          ["Guided Support", "Get help throughout your journey."],
          ["Clear & Transparent", "Know your service, pricing and next steps clearly."],
          ["Easy Tracking", "Stay updated on your application or booking."],
          ["Secure Payments", "Complete payments through a secure process."],
          ["Human Support", "Our team is here when you need assistance."],
        ]),
      },
    ],
  },
  {
    id: "about",
    label: "About TripNexio",
    fields: [
      { key: "about.eyebrow", label: "Small heading", kind: "text", fallback: "About TripNexio" },
      {
        key: "about.text",
        label: "Text",
        kind: "multiline",
        fallback:
          "TripNexio brings visa and travel services together in one simple experience. Choose your service, share your details, complete the required steps and track your request with guided support along the way.",
      },
      { key: "about.linkLabel", label: "Link label", kind: "text", fallback: "Learn More About Us" },
      {
        key: "about.image",
        label: "Picture",
        kind: "image",
        fallback: "https://images.unsplash.com/photo-1520437358207-323b43b50729?auto=format&fit=crop&w=1400&q=80",
      },
      { key: "about.imageAlt", label: "Picture description (for screen readers)", kind: "text", fallback: "Commercial aircraft taking off at dusk" },
    ],
  },
  {
    id: "cta",
    label: "Bottom banner",
    fields: [
      { key: "cta.title", label: "Heading", kind: "text", fallback: "Ready to simplify your journey?" },
      { key: "cta.primaryLabel", label: "Main button", kind: "text", fallback: "Explore Services" },
      { key: "cta.secondaryLabel", label: "Second button", kind: "text", fallback: "Track Status" },
    ],
  },
  {
    id: "support",
    label: "Need Help? + Secure Payments",
    fields: [
      { key: "support.helpTitle", label: "Help card — heading", kind: "text", fallback: "Need Help?" },
      { key: "support.helpText", label: "Help card — text", kind: "multiline", fallback: "Get quick assistance through TripNexio WhatsApp support." },
      { key: "support.helpButton", label: "Help card — button", kind: "text", fallback: "WhatsApp Support" },
      { key: "support.paymentTitle", label: "Payment card — heading", kind: "text", fallback: "Secure Payments" },
      {
        key: "support.paymentText",
        label: "Payment card — text",
        kind: "multiline",
        fallback: "Complete your payment securely with clear confirmation throughout the process.",
      },
      {
        key: "support.badges",
        label: "Badges",
        kind: "list",
        hint: "One badge per line.",
        fallback: listLines([["Secure Payments"], ["Protected Information"], ["Safe & Reliable"]]),
      },
    ],
  },
];
