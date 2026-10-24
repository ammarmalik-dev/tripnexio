import { listLines, type SiteSection } from "../section-types";

/** Client confirmation 2026-10-25 — the editable sections of the Visa Change page, top to bottom (below the hero). */
export const VISA_CHANGE_SECTIONS: SiteSection[] = [
  {
    id: "hero",
    label: "Hero — extra wording",
    fields: [{ key: "hero.trackLabel", label: "Track Status button", kind: "text", fallback: "Track Status" }],
  },
  {
    id: "overview",
    label: "What is Visa Change?",
    fields: [
      { key: "overview.eyebrow", label: "Small heading", kind: "text", fallback: "What is Visa Change?" },
      { key: "overview.heading", label: "Heading", kind: "text", fallback: "Your UAE Visa Change, guided end to end" },
      {
        key: "overview.body",
        label: "First paragraph",
        kind: "multiline",
        fallback:
          "Visa Change helps eligible travellers already in the UAE move through an available exit-and-new-visa process. Choose Airport-to-Airport or Border Exit, submit your details, and TripNexio coordinates the next steps once availability is confirmed.",
      },
      {
        key: "overview.body2",
        label: "Second paragraph",
        kind: "multiline",
        fallback: "The service has two methods: Airport-to-Airport (A2A) and Border Exit.",
      },
    ],
  },
  {
    id: "insideUae",
    label: "Currently in the UAE?",
    fields: [
      { key: "insideUae.eyebrow", label: "Small heading", kind: "text", fallback: "Currently in the UAE?" },
      { key: "insideUae.heading", label: "Heading", kind: "text", fallback: "Visa Change is available from inside the UAE" },
      { key: "insideUae.cardTitle", label: "Card title", kind: "text", fallback: "Inside UAE only" },
      {
        key: "insideUae.body",
        label: "Card text",
        kind: "multiline",
        fallback:
          "This service is for travellers who are currently in the UAE. Customers outside the UAE should use the relevant New Visa service instead.",
      },
      { key: "insideUae.eligibilityLabel", label: "Eligibility label", kind: "text", fallback: "Eligibility:" },
      {
        key: "insideUae.eligibility",
        label: "Eligibility text",
        kind: "multiline",
        fallback:
          "Visa Change is available for UAE tourist visa holders and holders of a cancelled UAE residence visa who are currently inside the UAE.",
      },
    ],
  },
  {
    id: "methods",
    label: "Choose your method",
    fields: [
      { key: "methods.eyebrow", label: "Small heading", kind: "text", fallback: "Choose your method" },
      { key: "methods.heading", label: "Heading", kind: "text", fallback: "Choose how you want to exit the UAE" },
      { key: "methods.a2aTitle", label: "Airport-to-Airport card — title", kind: "text", fallback: "Airport-to-Airport" },
      {
        key: "methods.a2aDescription",
        label: "Airport-to-Airport card — text",
        kind: "multiline",
        fallback:
          "Exit and re-enter the UAE by air through the same airport. We arrange the required flight and confirm the available airline, flight and timing before you choose.",
      },
      {
        key: "methods.a2aIncluded",
        label: "Airport-to-Airport card — what's included",
        kind: "list",
        hint: "One item per line. Quotations keep their own inclusions; this only changes the page.",
        fallback: listLines([["Round-trip flight ticket"], ["New UAE visa"]]),
      },
      { key: "methods.borderTitle", label: "Border card — title", kind: "text", fallback: "Border Exit & Re-entry" },
      {
        key: "methods.borderDescription",
        label: "Border card — text",
        kind: "multiline",
        fallback:
          "Exit and re-enter the UAE through a land border. We arrange the required border transportation and confirm the border, pickup and reporting details before you choose.",
      },
      {
        key: "methods.borderIncluded",
        label: "Border card — what's included",
        kind: "list",
        hint: "One item per line. Quotations keep their own inclusions; this only changes the page.",
        fallback: listLines([["Round-trip border transportation"], ["Stay, if applicable"], ["New UAE visa"], ["Oman visa"]]),
      },
      { key: "methods.includedLabel", label: "\"What's included\" label", kind: "text", fallback: "What’s included" },
      { key: "methods.notIncludedLabel", label: "\"What's not included\" label", kind: "text", fallback: "What’s not included" },
      {
        key: "methods.notIncluded",
        label: "What's not included",
        kind: "list",
        hint: "One item per line.",
        fallback: listLines([["Fines"], ["Border / immigration fees"], ["Meals"]]),
      },
      { key: "methods.routeEyebrow", label: "Route card — small heading", kind: "text", fallback: "How airports and borders work" },
      { key: "methods.routeHeading", label: "Route card — heading", kind: "text", fallback: "You choose the method. We confirm the route." },
      {
        key: "methods.routeBody",
        label: "Route card — text",
        kind: "multiline",
        fallback:
          "You do not need to choose a specific airport or border crossing. Select Airport-to-Airport or Border Exit, and our team confirms the available route, date, time and operational details. You will only see confirmed options available for your Visa Change.",
      },
    ],
  },
  {
    id: "requirements",
    label: "What You'll Need / Documents Required",
    fields: [
      { key: "requirements.needTitle", label: "Left card heading", kind: "text", fallback: "What You'll Need" },
      { key: "requirements.documentsTitle", label: "Right card heading", kind: "text", fallback: "Documents Required" },
      {
        key: "requirements.items",
        label: "What You'll Need",
        kind: "list",
        hint: 'One per line: "Item | short description".',
        fallback: listLines([
          ["Full name", "Applicant / passenger name"],
          ["Mobile number", "Active contact number"],
          ["Email address", "Email for updates and confirmations"],
          ["Passport number", "Required passenger identifier"],
          ["Visa expiry date", "Expiry date of your current visa"],
          ["Nationality", "Used for applicable documents and nationality-wise pricing"],
        ]),
      },
      {
        key: "requirements.documents",
        label: "Documents Required",
        kind: "list",
        hint: 'One per line: "Document | caption | optional". Leave out "optional" for a required document; a blank caption shows "Required" / "Where applicable".',
        fallback: listLines([
          ["Passport Front Page", "Required"],
          ["Passport Last Page", "Required"],
          ["Recent Photograph", "Recent passport-size photograph as per the required specifications."],
          [
            "Additional Documents",
            "Additional documents may be required depending on the applicant’s nationality and applicable immigration requirements.",
            "optional",
          ],
        ]),
      },
      {
        key: "requirements.notes",
        label: "Notes under the cards",
        kind: "list",
        hint: "One note per line.",
        fallback: listLines([
          ["You can add another passenger. Each passenger has their own nationality and Adult/Child details."],
          ["Document requirements may vary by nationality and application. Additional documents may be requested where required."],
          ["Actual upload occurs after successful payment. Existing valid documents may be reused where available."],
        ]),
      },
    ],
  },
  {
    id: "pricing",
    label: "Pricing",
    fields: [
      { key: "pricing.eyebrow", label: "Small heading", kind: "text", fallback: "Pricing" },
      { key: "pricing.heading", label: "Heading", kind: "text", fallback: "Your final price is confirmed after availability" },
      {
        key: "pricing.intro",
        label: "Intro",
        kind: "multiline",
        fallback:
          "Visa Change pricing is nationality-wise and depends on the confirmed method and package, passenger type, passenger count and applicable charges. The final price is shown after an available option is confirmed and you select your preferred package.",
      },
      {
        key: "pricing.emptyText",
        label: "Text when no prices are set",
        kind: "multiline",
        hint: "Shown instead of the price table while there are no active Visa Change prices (prices themselves are set in the Pricing Dashboard).",
        fallback:
          "Your nationality-wise price is shown before payment, once an available option is confirmed and you select your preferred package.",
      },
      { key: "pricing.nationalityHeader", label: "Table — Nationality column", kind: "text", fallback: "Nationality" },
      { key: "pricing.passengerHeader", label: "Table — Passenger column", kind: "text", fallback: "Passenger" },
      { key: "pricing.priceHeader", label: "Table — Price column", kind: "text", fallback: "Price" },
      { key: "pricing.otherNationality", label: "Table — \"Other nationality\" row", kind: "text", fallback: "Other nationality" },
      { key: "pricing.allNationalities", label: "Table — \"All nationalities\" row", kind: "text", fallback: "All nationalities" },
    ],
  },
  {
    id: "howItWorks",
    label: "How It Works — heading",
    fields: [
      { key: "howItWorks.eyebrow", label: "Small heading", kind: "text", fallback: "Simple steps" },
      { key: "howItWorks.heading", label: "Heading", kind: "text", fallback: "How It Works" },
    ],
  },
  {
    id: "confirmed",
    label: "Confirmed Options",
    fields: [
      { key: "confirmed.eyebrow", label: "Small heading", kind: "text", fallback: "A2A / Border package" },
      { key: "confirmed.heading", label: "Heading", kind: "text", fallback: "Confirmed Options" },
      {
        key: "confirmed.intro",
        label: "Intro",
        kind: "multiline",
        fallback: "You select one confirmed package. These details are supplied by TripNexio; you do not manually enter them.",
      },
      { key: "confirmed.cardLead", label: "Line above each card's list", kind: "text", fallback: "After availability is confirmed, you will see:" },
      { key: "confirmed.a2aTitle", label: "A2A card — title", kind: "text", fallback: "A2A" },
      {
        key: "confirmed.a2aItems",
        label: "A2A card — items",
        kind: "list",
        hint: "One item per line.",
        fallback: listLines([
          ["Exit & Re-entry Airport name"],
          ["Flight details"],
          ["Travel Date & timing"],
          ["Reporting date & time"],
          ["Package details"],
        ]),
      },
      { key: "confirmed.borderTitle", label: "Border card — title", kind: "text", fallback: "Border Exit & Re-entry" },
      {
        key: "confirmed.borderItems",
        label: "Border card — items",
        kind: "list",
        hint: "One item per line.",
        fallback: listLines([
          ["Transit country name (Non UAE side border)"],
          ["Pickup & drop Location"],
          ["Pickup Person details"],
          ["Travel Date & timing"],
          ["Reporting date & time"],
          ["Package details"],
        ]),
      },
    ],
  },
  {
    id: "payment",
    label: "Before payment / After payment",
    fields: [
      { key: "payment.heading", label: "Heading", kind: "text", fallback: "Before payment / After payment" },
      {
        key: "payment.cards",
        label: "Cards",
        kind: "list",
        hint: 'One per line: "Title | text". Icons repeat in order when you add cards.',
        fallback: listLines([
          ["Before payment", "You see the confirmed package, final rate, terms and summary. Payment is then completed."],
          [
            "After payment",
            "Your Booking ID is generated, you can upload required documents, and package generation proceeds once operational requirements are complete.",
          ],
        ]),
      },
    ],
  },
  {
    id: "afterExit",
    label: "Exit completed",
    fields: [
      { key: "afterExit.heading", label: "Heading", kind: "text", fallback: "Exit completed. What happens next?" },
      {
        key: "afterExit.body",
        label: "Text",
        kind: "multiline",
        fallback:
          "Once the confirmed exit is completed, TripNexio records the exit and starts New Visa Processing. Additional documents may be requested during the next stage if required.",
      },
    ],
  },
  {
    id: "cta",
    label: "Closing banner — extra wording",
    fields: [{ key: "cta.trackLabel", label: "Track Status button", kind: "text", fallback: "Track Status" }],
  },
  {
    id: "faq",
    label: "FAQ section (the questions are edited in Admin → FAQs)",
    fields: [{ key: "faq.title", label: "Heading", kind: "text", fallback: "Frequently asked questions" }],
  },
];
