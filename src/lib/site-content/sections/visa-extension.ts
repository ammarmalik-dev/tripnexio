import { listLines, type SiteSection } from "../section-types";

/** Shown in Admin next to wording that carries the Admin-set payment-link validity. */
const HOURS_HINT = 'Write {hours} where the payment-link validity goes (e.g. "24 hours", from Admin timelines).';

/** Client confirmation 2026-10-25 — the editable sections of the Visa Extension page, top to bottom (below the hero). */
export const VISA_EXTENSION_SECTIONS: SiteSection[] = [
  {
    id: "hero",
    label: "Hero — extra wording",
    fields: [
      { key: "hero.tagline", label: "Highlights line", kind: "text", fallback: "30-Day Extension • Online Request • Guided Process" },
      { key: "hero.trackLabel", label: "Track Status button", kind: "text", fallback: "Track Status" },
    ],
  },
  {
    id: "whoFor",
    label: "Who is this for?",
    fields: [
      { key: "whoFor.eyebrow", label: "Small heading", kind: "text", fallback: "Who is this for?" },
      { key: "whoFor.heading", label: "Heading", kind: "text", fallback: "Only for TripNexio-issued visas" },
      {
        key: "whoFor.body",
        label: "Text",
        kind: "multiline",
        fallback:
          "We currently offer Visa Extension only for visas originally issued through TripNexio. If we can't find a matching TripNexio visa for your details, we'll guide you to Visa Change instead.",
      },
    ],
  },
  {
    id: "options",
    label: "Extension options (cards come from Admin → Sub-services and Pricing)",
    fields: [
      { key: "options.eyebrow", label: "Small heading", kind: "text", fallback: "Extension options" },
      { key: "options.heading", label: "Heading", kind: "text", fallback: "Choose your extension" },
      { key: "options.intro", label: "Intro text", kind: "multiline", fallback: "Final price is confirmed on your quotation after we verify your visa." },
      { key: "options.fromLabel", label: "Price label", kind: "text", fallback: "From" },
      { key: "options.quoteLabel", label: "Text when no price is set", kind: "text", fallback: "Price shared on your quotation" },
      { key: "options.note", label: "Terms note", kind: "text", fallback: "Subject to verification and the" },
      { key: "options.termsLabel", label: "Terms link text", kind: "text", fallback: "Terms & Conditions" },
    ],
  },
  {
    id: "requirements",
    label: "What You'll Need",
    fields: [
      { key: "requirements.needTitle", label: "Left card heading", kind: "text", fallback: "What You'll Need" },
      { key: "requirements.documentsTitle", label: "Right card heading", kind: "text", fallback: "Documents Required" },
      {
        key: "requirements.items",
        label: "Items",
        kind: "list",
        hint: 'One per line: "Item | short description".',
        fallback: listLines([
          ["Name", "As printed on the passport"],
          ["Mobile Number", "Active contact number for updates"],
          ["Email Address", "For your quotation and extension updates"],
          ["Passport Number", "For every applicant"],
          ["Visa Expiry Date", "The expiry date on your current visa"],
        ]),
      },
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
    id: "details",
    label: "UAE Visa Extension details",
    fields: [
      { key: "details.eyebrow", label: "Small heading", kind: "text", fallback: "At a glance" },
      { key: "details.heading", label: "Heading", kind: "text", fallback: "UAE Visa Extension details" },
      {
        key: "details.items",
        label: "Detail cards",
        kind: "list",
        hint: `One per line: "Label | value". ${HOURS_HINT}`,
        fallback: listLines([
          ["Extension Duration", "30 Days"],
          ["Eligibility", "TripNexio-issued UAE visa"],
          ["Extension Fee", "Shown after eligibility review"],
          ["Applicable Fine", "Added where required"],
          ["Payment Link", "Valid for {hours}"],
          ["New Extension Validity", "Counted from the original visa expiry date"],
        ]),
      },
    ],
  },
  {
    id: "notices",
    label: "Important before you request an extension",
    fields: [
      { key: "notices.eyebrow", label: "Small heading", kind: "text", fallback: "Good to know" },
      { key: "notices.heading", label: "Heading", kind: "text", fallback: "Important before you request an extension" },
      {
        key: "notices.items",
        label: "Notice cards",
        kind: "list",
        hint: 'One per line: "Title | text".',
        fallback: listLines([
          [
            "Actual expiry is checked during review",
            "The expiry date used for your request must be your current visa expiry date. Any estimated timing is not a confirmed expiry date.",
          ],
          ["30+ days expired", "If the visa has been expired for 30 days or more, it is not eligible for the 30-day Visa Extension."],
          [
            "Visa expires today",
            "Same-day expiry cases require urgent handling. The current operational payment deadline is 6:00 PM on the same working day. Applicable fines remain subject to the relevant authority rules.",
          ],
        ]),
      },
    ],
  },
  {
    id: "documentsPayment",
    label: "Documents & payment",
    fields: [
      { key: "documentsPayment.documentsHeading", label: "Documents card — heading", kind: "text", fallback: "Documents" },
      {
        key: "documentsPayment.documentsBody",
        label: "Documents card — text",
        kind: "multiline",
        fallback:
          "We may use eligible documents already available in your TripNexio records after your confirmation. If additional information or documents are required, we'll let you know.",
      },
      {
        key: "documentsPayment.documentsNote",
        label: "Documents card — highlighted note",
        kind: "text",
        fallback: "Existing documents are never reused without your confirmation.",
      },
      { key: "documentsPayment.paymentHeading", label: "Payment card — heading", kind: "text", fallback: "Pay after your extension is reviewed" },
      {
        key: "documentsPayment.paymentBody",
        label: "Payment card — text",
        kind: "multiline",
        fallback:
          "Your final amount is provided after your visa details and extension eligibility are reviewed. The total may include the extension fee, applicable fine or overstay amount, and other applicable charges.",
      },
      {
        key: "documentsPayment.paymentNote",
        label: "Payment card — payment-link note",
        kind: "multiline",
        hint: HOURS_HINT,
        fallback: "Payment-link validity: {hours}. If the link expires, the TripNexio team can generate a new link.",
      },
      { key: "documentsPayment.requestLabel", label: "Payment card — request button", kind: "text", fallback: "Request Extension" },
      { key: "documentsPayment.supportLabel", label: "Payment card — support button", kind: "text", fallback: "Payment Support" },
    ],
  },
  {
    id: "afterPayment",
    label: "After payment",
    fields: [
      { key: "afterPayment.eyebrow", label: "Small heading", kind: "text", fallback: "What happens next" },
      { key: "afterPayment.heading", label: "Heading", kind: "text", fallback: "After payment" },
      {
        key: "afterPayment.items",
        label: "Stages",
        kind: "list",
        hint: 'One per line: "Title | text".',
        fallback: listLines([
          ["Payment Received", "Your payment is confirmed."],
          ["Extension Processing", "The paid extension process begins."],
          ["Extended Visa Ready", "The new extended visa copy is received."],
          ["Visa Delivered", "The extended visa is delivered through the available customer communication channels."],
        ]),
      },
    ],
  },
  {
    id: "outcomes",
    label: "If your extension isn't approved",
    fields: [
      { key: "outcomes.eyebrow", label: "Small heading", kind: "text", fallback: "Outcomes" },
      { key: "outcomes.heading", label: "Heading", kind: "text", fallback: "If your extension isn't approved" },
      {
        key: "outcomes.intro",
        label: "Intro text",
        kind: "multiline",
        fallback: "The detailed refund rules are set out in our Refund & Cancellation Policy and FAQ.",
      },
      {
        key: "outcomes.items",
        label: "Outcome cards",
        kind: "list",
        hint: 'One per line: "Title | text".',
        fallback: listLines([
          ["Not Accepted", "Applicable refund: payment minus gateway charges."],
          ["Rejected", "Formal rejection follows the current no-refund rule."],
        ]),
      },
    ],
  },
  {
    id: "cta",
    label: "Closing banner",
    fields: [
      { key: "cta.body", label: "Text", kind: "multiline", fallback: "Check your extension eligibility and submit your request online." },
      { key: "cta.primaryLabel", label: "Main button", kind: "text", fallback: "Check Extension Eligibility" },
      { key: "cta.trackLabel", label: "Track Status button", kind: "text", fallback: "Track Status" },
    ],
  },
  {
    id: "faq",
    label: "FAQ section (the questions are edited in Admin → FAQs)",
    fields: [{ key: "faq.title", label: "Heading", kind: "text", fallback: "Frequently asked questions" }],
  },
];
