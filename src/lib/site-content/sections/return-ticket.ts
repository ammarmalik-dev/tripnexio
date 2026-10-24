import { listLines, type SiteSection } from "../section-types";

const PARAGRAPHS_HINT = "One paragraph per line.";

/** Client confirmation 2026-10-25 — the editable sections of the Return Ticket page, top to bottom (below the hero). */
export const RETURN_TICKET_SECTIONS: SiteSection[] = [
  {
    id: "heroButtons",
    label: "Hero — second button",
    fields: [{ key: "heroButtons.trackLabel", label: "Track Status button", kind: "text", fallback: "Track Status" }],
  },
  {
    id: "about",
    label: "What is a Return Verified Ticket?",
    fields: [
      { key: "about.eyebrow", label: "Small heading", kind: "text", fallback: "What is a Return Verified Ticket?" },
      { key: "about.title", label: "Heading", kind: "text", fallback: "Your return ticket, arranged for your trip" },
      {
        key: "about.intro",
        label: "Intro text",
        kind: "multiline",
        fallback:
          "A Return Verified Ticket is a return ticket reservation arranged for international travel and intended to provide proof of return travel where applicable. TripNexio arranges the reservation according to the travel details provided and configured airline/partner availability.",
      },
    ],
  },
  {
    id: "returnDate",
    label: "How the return date works",
    fields: [
      { key: "returnDate.eyebrow", label: "Small heading", kind: "text", fallback: "How the return date works" },
      { key: "returnDate.title", label: "Heading", kind: "text", fallback: "Tell us your expected return date" },
      {
        key: "returnDate.intro",
        label: "Intro text",
        kind: "multiline",
        fallback:
          "You select your destination country, travel date and expected return date. TripNexio looks for a suitable return ticket close to your expected date and issues it according to live ticket availability.",
      },
      {
        key: "returnDate.points",
        label: "Bullet points",
        kind: "list",
        hint: "One bullet point per line.",
        fallback: listLines([
          [
            "No visa-validity date is requested. You provide an expected return date so we can search for a suitable ticket close to that date.",
          ],
          [
            "The exact issue date is not selected by you. TripNexio issues the reservation according to available ticket inventory and the applicable travel schedule.",
          ],
        ]),
      },
    ],
  },
  {
    id: "requirements",
    label: "What You'll Need + Documents Required (the documents list comes from Service Configuration → Documents)",
    fields: [
      { key: "requirements.needTitle", label: "Left card — heading", kind: "text", fallback: "What You'll Need" },
      {
        key: "requirements.whatYouNeed",
        label: "What You'll Need",
        kind: "list",
        hint: 'One item per line: "Item | short description".',
        fallback: listLines([
          ["Full name", "As printed on the passport"],
          ["Mobile number", "Active contact number for updates"],
          ["Email address", "For your booking confirmation and reservation"],
          ["Passport number", "For every traveller on the booking"],
          ["Destination country", "The country you are travelling to"],
          ["Number of passengers", "Adults, children and infants travelling"],
          ["Travel date", "Your planned date of departure"],
          ["Expected return date", "The date you plan to return"],
        ]),
      },
      { key: "requirements.documentsTitle", label: "Right card — heading", kind: "text", fallback: "Documents Required" },
      {
        key: "requirements.notes",
        label: "Notes under both cards",
        kind: "list",
        hint: PARAGRAPHS_HINT,
        fallback: listLines([
          [
            "Additional information or documents may be requested when necessary for the selected destination, airline/partner or reservation process.",
          ],
        ]),
      },
    ],
  },
  {
    id: "howItWorks",
    label: "How It Works — heading (steps are edited above)",
    fields: [
      { key: "howItWorks.eyebrow", label: "Small heading", kind: "text", fallback: "Simple steps" },
      { key: "howItWorks.title", label: "Heading", kind: "text", fallback: "How It Works" },
    ],
  },
  {
    id: "verification",
    label: "Verifiable reservation + When we issue the ticket",
    fields: [
      { key: "verification.eyebrow", label: "Small heading", kind: "text", fallback: "Verifiable reservation" },
      { key: "verification.title", label: "Heading", kind: "text", fallback: "Check your reservation using the PNR" },
      {
        key: "verification.intro",
        label: "Intro text",
        kind: "multiline",
        fallback:
          "Where the selected airline/partner process supports online verification, the issued reservation can be checked on the airline website using the PNR and the basic reservation information.",
      },
      { key: "verification.cardTitle", label: "Card — heading", kind: "text", fallback: "What you’ll use to check it" },
      {
        key: "verification.cardPoints",
        label: "Card — bullet points",
        kind: "list",
        hint: "One bullet point per line.",
        fallback: listLines([
          ["PNR / reservation reference"],
          ["Passenger name or other basic reservation information requested by the airline"],
        ]),
      },
      { key: "verification.timingTitle", label: "Dark card — heading", kind: "text", fallback: "When we issue the ticket" },
      {
        key: "verification.timingBody",
        label: "Dark card — text",
        kind: "multiline",
        fallback:
          "TripNexio does not promise that the reservation will be issued on the exact day you submit the request. We issue the reservation according to ticket availability, partner/airline processing and the configured travel schedule.",
      },
    ],
  },
  {
    id: "cancellation",
    label: "Cancellation + Price for your destination (prices and fees come from the Pricing Dashboard)",
    fields: [
      { key: "cancellation.eyebrow", label: "Small heading", kind: "text", fallback: "Cancellation" },
      { key: "cancellation.title", label: "Heading", kind: "text", fallback: "Cancellation charges may apply" },
      {
        key: "cancellation.intro",
        label: "Intro text",
        kind: "multiline",
        fallback:
          "Customers can request cancellation according to the configured refund policy. A cancellation fee may be deducted from the eligible refund amount.",
      },
      {
        key: "cancellation.note",
        label: "Info box text",
        kind: "multiline",
        fallback:
          "Once the request has reached the locked non-refundable stage — after document validation and forwarding to the airline/partner — the booking is non-refundable. Ticket issuance is also non-refundable under the current business rules. Payment gateway charges are non-refundable.",
      },
      { key: "cancellation.priceTitle", label: "Price card — heading", kind: "text", fallback: "Price for your destination" },
      { key: "cancellation.selectLabel", label: "Price card — destination field label", kind: "text", fallback: "Destination country" },
      { key: "cancellation.selectPlaceholder", label: "Price card — destination field placeholder", kind: "text", fallback: "Select a destination" },
      {
        key: "cancellation.selectPrompt",
        label: "Price card — text before a destination is picked",
        kind: "text",
        fallback: "Select your destination to see the applicable price.",
      },
      { key: "cancellation.priceLabel", label: "Price card — price label", kind: "text", fallback: "Price per passenger" },
      { key: "cancellation.feeLabel", label: "Price card — cancellation fee label", kind: "text", fallback: "Cancellation fee" },
      { key: "cancellation.noFeeLabel", label: "Price card — shown when there is no cancellation fee", kind: "text", fallback: "None" },
      {
        key: "cancellation.priceNote",
        label: "Price card — note under the prices",
        kind: "multiline",
        fallback: "The applicable cancellation fee and refund rule are shown again in your summary before payment.",
      },
      {
        key: "cancellation.noPricesText",
        label: "Price card — text when no destination prices are set",
        kind: "multiline",
        fallback: "The applicable price and cancellation fee for your destination are shown clearly before payment.",
      },
    ],
  },
  {
    id: "disclaimer",
    label: "Travel & immigration disclaimer + After travel",
    fields: [
      { key: "disclaimer.title", label: "Disclaimer card — heading", kind: "text", fallback: "Travel & immigration disclaimer" },
      {
        key: "disclaimer.paragraphs",
        label: "Disclaimer card — text",
        kind: "list",
        hint: PARAGRAPHS_HINT,
        fallback: listLines([
          [
            "TripNexio is a return-ticket service provider. TripNexio is not responsible for airline boarding decisions, immigration clearance, border decisions, visa decisions or entry decisions made by the relevant airline or authority.",
          ],
          [
            "Airline schedules, cancellations, rescheduling, denied boarding and immigration or border decisions are outside TripNexio’s control. Customers remain responsible for complying with applicable airline, visa and immigration requirements, subject to the agreed Terms & Conditions.",
          ],
        ]),
      },
      { key: "disclaimer.afterEyebrow", label: "After travel card — small heading", kind: "text", fallback: "Completion" },
      { key: "disclaimer.afterTitle", label: "After travel card — heading", kind: "text", fallback: "After travel" },
      {
        key: "disclaimer.afterParagraphs",
        label: "After travel card — text",
        kind: "list",
        hint: PARAGRAPHS_HINT,
        fallback: listLines([
          [
            "Once the planned travel schedule has passed, the Return Verified Ticket booking can be automatically marked completed according to the configured post-travel workflow.",
          ],
          [
            "You don’t need to manually close the service unless the configured workflow specifically requests an action. Your issued ticket and booking history stay available in your customer record.",
          ],
        ]),
      },
    ],
  },
  {
    id: "faq",
    label: "FAQ section (the questions are edited in Admin → FAQs)",
    fields: [{ key: "faq.title", label: "Heading", kind: "text", fallback: "Frequently asked questions" }],
  },
];
