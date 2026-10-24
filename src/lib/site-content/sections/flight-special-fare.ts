import { listLines, type SiteSection } from "../section-types";

const PARAGRAPHS_HINT = "One paragraph per line.";
const ITEMS_HINT = "One item per line.";
const CARDS_HINT = 'One card per line: "Title | description".';

/** Client confirmation 2026-10-25 — the editable sections of the Flight Special Fare page, top to bottom (below the hero). */
export const FLIGHT_SPECIAL_FARE_SECTIONS: SiteSection[] = [
  {
    id: "heroButtons",
    label: "Hero — highlight pills + second button",
    fields: [
      {
        key: "heroButtons.highlights",
        label: "Highlight pills",
        kind: "list",
        hint: ITEMS_HINT,
        fallback: listLines([["Domestic + Worldwide"], ["Discounted Special Fares"], ["Multiple Flight Options"]]),
      },
      { key: "heroButtons.trackLabel", label: "Track Status button", kind: "text", fallback: "Track Status" },
    ],
  },
  {
    id: "about",
    label: "What is a special fare? + fare advantage card",
    fields: [
      { key: "about.eyebrow", label: "Small heading", kind: "text", fallback: "What is a special fare?" },
      { key: "about.title", label: "Heading", kind: "text", fallback: "Discounted fares sourced for your trip" },
      {
        key: "about.paragraphs",
        label: "Text",
        kind: "list",
        hint: PARAGRAPHS_HINT,
        fallback: listLines([
          [
            "TripNexio works with airlines, agencies and partners to source special flight inventory. For selected routes and travel dates, this can include group or pre-purchased inventory secured in advance, allowing us to offer discounted fares when that inventory is available.",
          ],
          [
            "When special inventory is not available, our team can also check regular offline fares through our airline and agency relationships.",
          ],
        ]),
      },
      {
        key: "about.cardText",
        label: "Card — text",
        kind: "multiline",
        fallback: "Fare advantage depends on route, date, inventory, passenger type and supplier availability.",
      },
    ],
  },
  {
    id: "fareSources",
    label: "Fares are checked, not searched live (3 cards)",
    fields: [
      { key: "fareSources.eyebrow", label: "Small heading", kind: "text", fallback: "Fares are checked, not searched live" },
      { key: "fareSources.title", label: "Heading", kind: "text", fallback: "We check the market for you" },
      {
        key: "fareSources.intro",
        label: "Intro text",
        kind: "multiline",
        fallback:
          "There is no public live fare search or live airline inventory. Our team checks available special inventory, group-sourced fares and regular offline fares through configured airline, agency and partner sources, then sends you the available options.",
      },
      {
        key: "fareSources.cards",
        label: "Cards",
        kind: "list",
        hint: CARDS_HINT,
        fallback: listLines([
          ["Special Inventory", "Group or pre-purchased inventory may provide discounted fares on selected routes and dates."],
          ["Regular Offline Fares", "Our team can also check normal fares through airline and agency sources."],
          ["Multiple Options", "Where available, you may receive more than one airline, timing or route option."],
        ]),
      },
    ],
  },
  {
    id: "requirements",
    label: "What You'll Need + Documents Required",
    fields: [
      { key: "requirements.needTitle", label: "Left card heading", kind: "text", fallback: "What You'll Need" },
      { key: "requirements.documentsTitle", label: "Right card heading", kind: "text", fallback: "Documents Required" },
      {
        key: "requirements.whatYouNeed",
        label: "What You'll Need",
        kind: "list",
        hint: 'One item per line: "Item | short caption" (the caption is optional).',
        fallback: listLines([
          ["Full name", "Passenger/customer name"],
          ["Mobile number", "Active contact number"],
          ["Email address", "For quote and booking updates"],
          ["Departure city / airport", "Where you want to travel from"],
          ["Destination city / airport", "Where you want to travel to"],
          ["Travel date", "Your planned date of travel"],
          ["Passenger details", "Adults, children and infants where applicable"],
        ]),
      },
      {
        key: "requirements.documents",
        label: "Documents Required",
        kind: "list",
        hint: 'One document per line: "Document | short caption" (blank caption shows "Required").',
        fallback: listLines([
          ["Passport / Government ID", "A valid passport or govt-issued photo ID accepted by the airline."],
          ["Visa Copy", "Required only when applicable for the destination."],
        ]),
      },
      {
        key: "requirements.notes",
        label: "Notes under the cards",
        kind: "list",
        hint: "One note per line.",
        fallback: listLines([["Current request window: up to 45 days before travel."]]),
      },
    ],
  },
  {
    id: "passengerTypes",
    label: "Passenger types (Adult / Child / Infant)",
    fields: [
      { key: "passengerTypes.eyebrow", label: "Small heading", kind: "text", fallback: "Passenger types" },
      { key: "passengerTypes.title", label: "Heading", kind: "text", fallback: "Your fare is calculated for each traveller" },
      {
        key: "passengerTypes.intro",
        label: "Intro text",
        kind: "multiline",
        fallback: "Passenger type is calculated from date of birth and age on the travel date:",
      },
      {
        key: "passengerTypes.cards",
        label: "Cards",
        kind: "list",
        hint: 'One card per line: "Passenger type | age".',
        fallback: listLines([
          ["Adult", "12+"],
          ["Child", "2–11"],
          ["Infant", "Under 2"],
        ]),
      },
    ],
  },
  {
    id: "howItWorks",
    label: "How It Works — headings (the steps are edited above)",
    fields: [
      { key: "howItWorks.eyebrow", label: "Small heading", kind: "text", fallback: "Simple steps" },
      { key: "howItWorks.title", label: "Heading", kind: "text", fallback: "How It Works" },
    ],
  },
  {
    id: "options",
    label: "More than one option may be available",
    fields: [
      { key: "options.eyebrow", label: "Small heading", kind: "text", fallback: "Compare available options" },
      { key: "options.title", label: "Heading", kind: "text", fallback: "More than one option may be available" },
      {
        key: "options.intro",
        label: "Intro text",
        kind: "multiline",
        fallback:
          "Depending on availability, TripNexio may send multiple flight options for the same request. Options can differ by airline, flight timing, route or fare.",
      },
      { key: "options.cardTitle", label: "Card — heading", kind: "text", fallback: "Each option shows" },
      {
        key: "options.items",
        label: "Card — list",
        kind: "list",
        hint: ITEMS_HINT,
        fallback: listLines([
          ["Airline"],
          ["Flight number"],
          ["Departure / arrival"],
          ["Travel date"],
          ["Departure / arrival time"],
          ["Baggage"],
          ["Fare"],
          ["Quote validity"],
          ["Booking deadline (where applicable)"],
        ]),
      },
    ],
  },
  {
    id: "validity",
    label: "Limited-time quote",
    fields: [
      { key: "validity.eyebrow", label: "Small heading", kind: "text", fallback: "Limited-time quote" },
      { key: "validity.title", label: "Heading", kind: "text", fallback: "Your fare is available for a limited time" },
      {
        key: "validity.paragraphs",
        label: "Text",
        kind: "list",
        hint: `${PARAGRAPHS_HINT} {minutes} is replaced by the quote validity set in Service Configuration (e.g. "30 minutes").`,
        fallback: listLines([
          [
            "A Special Fare quotation can be valid for a maximum of {minutes}. The customer sees a countdown while the quotation is active.",
          ],
          ["Payment is blocked after the quote expires and the old quote cannot simply be reused."],
        ]),
      },
      {
        key: "validity.reminderNote",
        label: "Reminder note",
        kind: "multiline",
        fallback: "While valid, reminders can be sent every 10 minutes; reminders stop after expiry.",
      },
      { key: "validity.maxLabel", label: "Validity card — label", kind: "text", fallback: "Maximum validity" },
      { key: "validity.expiryLabel", label: "Expiry card — label", kind: "text", fallback: "After expiry:" },
      {
        key: "validity.expiryMessage",
        label: "Expiry card — message",
        kind: "text",
        fallback: "This Special Fare quotation has expired.",
      },
      { key: "validity.buttonLabel", label: "Expiry card — button", kind: "text", fallback: "Request New Quote" },
    ],
  },
  {
    id: "alternativeRoute",
    label: "If your requested route is not available",
    fields: [
      { key: "alternativeRoute.eyebrow", label: "Small heading", kind: "text", fallback: "If your requested route is not available" },
      { key: "alternativeRoute.title", label: "Heading", kind: "text", fallback: "We may offer an alternative route" },
      {
        key: "alternativeRoute.intro",
        label: "Intro text",
        kind: "multiline",
        fallback: "If the requested route is unavailable, our team can manually offer an alternative route.",
      },
      {
        key: "alternativeRoute.note",
        label: "Note",
        kind: "multiline",
        fallback: "The customer must clearly see that the alternative is different from the original request.",
      },
      { key: "alternativeRoute.exampleTitle", label: "Example card — heading", kind: "text", fallback: "Example:" },
      {
        key: "alternativeRoute.exampleRoutes",
        label: "Example card — routes",
        kind: "list",
        hint: 'One route per line: "Label | from | to". Every route after the first is highlighted.',
        fallback: listLines([
          ["Requested", "Jaipur", "Dubai"],
          ["Alternative", "Delhi", "Dubai"],
        ]),
      },
    ],
  },
  {
    id: "afterPayment",
    label: "Payment starts the final confirmation process",
    fields: [
      { key: "afterPayment.eyebrow", label: "Small heading", kind: "text", fallback: "Final availability confirmation" },
      { key: "afterPayment.title", label: "Heading", kind: "text", fallback: "Payment starts the final confirmation process" },
      {
        key: "afterPayment.intro",
        label: "Intro text",
        kind: "multiline",
        fallback:
          "Payment does not automatically mean the ticket has been issued. After payment, our team and airline partner confirm the final seat and fare.",
      },
      {
        key: "afterPayment.availability",
        label: "Availability cards",
        kind: "list",
        hint: 'One card per line: "Bold lead-in | text".',
        fallback: listLines([
          ["If available:", "proceed to ticket issuance."],
          ["If unavailable:", "an alternative flow may be offered."],
        ]),
      },
      {
        key: "afterPayment.outcomes",
        label: "Alternative outcome cards",
        kind: "list",
        hint: CARDS_HINT,
        fallback: listLines([
          ["Higher fare", "Customer can pay the additional amount or request a refund."],
          ["Lower fare", "Applicable difference refund."],
          ["No suitable alternative", "Full refund."],
        ]),
      },
      {
        key: "afterPayment.note",
        label: "Closing note",
        kind: "text",
        fallback: "The customer must never be forced to accept a higher fare.",
      },
    ],
  },
  {
    id: "baggageRefund",
    label: "Baggage + Cancellation & refund cards",
    fields: [
      { key: "baggageRefund.baggageTitle", label: "Baggage card — heading", kind: "text", fallback: "Baggage" },
      {
        key: "baggageRefund.baggageText",
        label: "Baggage card — text",
        kind: "multiline",
        fallback:
          "Baggage allowance is shown with the quoted flight option and is entered according to the applicable airline/fare information.",
      },
      { key: "baggageRefund.refundEyebrow", label: "Refund card — small heading", kind: "text", fallback: "Cancellation & refund" },
      {
        key: "baggageRefund.refundTitle",
        label: "Refund card — heading",
        kind: "text",
        fallback: "Cancellation depends on the applicable fare rules",
      },
      {
        key: "baggageRefund.refundText",
        label: "Refund card — text",
        kind: "multiline",
        fallback: "Cancellation and refund eligibility depends on the applicable airline/partner rules and configured charges.",
      },
      {
        key: "baggageRefund.formulaLabel",
        label: "Refund card — calculation label",
        kind: "text",
        fallback: "Configured refund calculation:",
      },
      {
        key: "baggageRefund.formula",
        label: "Refund card — calculation",
        kind: "text",
        fallback: "Paid Amount − Airline/Partner Cancellation Charge − Gateway Charge",
      },
    ],
  },
  {
    id: "ticketDelivery",
    label: "When your ticket is issued",
    fields: [
      { key: "ticketDelivery.eyebrow", label: "Small heading", kind: "text", fallback: "Ticket delivery" },
      { key: "ticketDelivery.title", label: "Heading", kind: "text", fallback: "When your ticket is issued" },
      {
        key: "ticketDelivery.intro",
        label: "Intro text",
        kind: "multiline",
        fallback: "The ticket is delivered through WhatsApp, email and any configured customer channel.",
      },
      {
        key: "ticketDelivery.cardTitle",
        label: "Card — heading",
        kind: "text",
        fallback: "After final confirmation, the issued ticket can include:",
      },
      {
        key: "ticketDelivery.items",
        label: "Card — list",
        kind: "list",
        hint: ITEMS_HINT,
        fallback: listLines([["PNR"], ["Passenger details"], ["Airline"], ["Flight"], ["Baggage"], ["Ticket PDF"]]),
      },
    ],
  },
  {
    id: "faq",
    label: "FAQ section (the questions are edited in Admin → FAQs)",
    fields: [{ key: "faq.title", label: "Heading", kind: "text", fallback: "Frequently asked questions" }],
  },
];
