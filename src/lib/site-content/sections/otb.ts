import { listLines, type SiteSection } from "../section-types";

const PARAGRAPHS_HINT = "One paragraph per line.";

/** Client confirmation 2026-10-25 — the editable sections of the OTB page, top to bottom (below the hero). */
export const OTB_SECTIONS: SiteSection[] = [
  {
    id: "heroButtons",
    label: "Hero — second button",
    fields: [{ key: "heroButtons.trackLabel", label: "Track Status button", kind: "text", fallback: "Track Status" }],
  },
  {
    id: "about",
    label: "What is OK to Board? + passport endorsement card",
    fields: [
      { key: "about.eyebrow", label: "Small heading", kind: "text", fallback: "What is OK to Board?" },
      { key: "about.title", label: "Heading", kind: "text", fallback: "Your airline clearance, handled for you" },
      {
        key: "about.intro",
        label: "Intro text",
        kind: "multiline",
        fallback:
          "OK to Board (OTB) is an airline clearance process that may be required for certain Gulf-bound journeys. TripNexio helps eligible Indian passport holders arrange OTB before travel through the applicable airline/process channel. OTB is an airline process and is separate from Indian emigration clearance.",
      },
      { key: "about.cardEyebrow", label: "Card — small heading", kind: "text", fallback: "ECR / Non-ECR" },
      { key: "about.cardTitle", label: "Card — heading", kind: "text", fallback: "Check your passport endorsement" },
      {
        key: "about.cardParagraphs",
        label: "Card — text",
        kind: "list",
        hint: PARAGRAPHS_HINT,
        fallback: listLines([
          [
            "An ECR passport has the words “Emigration Check Required” printed/endorsed on the passport, usually on the last page/endorsement area. If that isn’t printed, the passport is treated as Non-ECR / ECNR for this service.",
          ],
          [
            "Indian ECR passport holders travelling on an applicable eVisa are advised to arrange OTB before travel. ECNR / Non-ECR travellers may not require OTB, but can request it where they want the airline clearance arranged and the applicable process supports it.",
          ],
        ]),
      },
    ],
  },
  {
    id: "ecrEcnr",
    label: "OTB support for ECR and ECNR travellers",
    fields: [
      { key: "ecrEcnr.eyebrow", label: "Small heading", kind: "text", fallback: "ECR & ECNR" },
      { key: "ecrEcnr.title", label: "Heading", kind: "text", fallback: "OTB support for ECR and ECNR travellers" },
      {
        key: "ecrEcnr.cards",
        label: "Cards",
        kind: "list",
        hint: 'One card per line: "Title | description".',
        fallback: listLines([
          [
            "ECR Passport Holders",
            "For a smoother travel experience, TripNexio accepts OTB applications from Indian ECR passport holders travelling on applicable Gulf-bound flights and processes the OTB before travel.",
          ],
          [
            "ECNR / Non-ECR Passport Holders",
            "OTB may not be required for every ECNR/Non-ECR traveller. However, customers who want OTB arranged can request the service where the applicable airline/process channel supports it.",
          ],
        ]),
      },
      {
        key: "ecrEcnr.note",
        label: "Note under the cards",
        kind: "multiline",
        fallback: "OTB is an airline clearance service; it is not a substitute for Indian emigration clearance.",
      },
    ],
  },
  {
    id: "departure",
    label: "India departure + Airline network cards",
    fields: [
      { key: "departure.eyebrow", label: "India departure card — small heading", kind: "text", fallback: "India departure" },
      { key: "departure.title", label: "India departure card — heading", kind: "text", fallback: "OTB for Indian travellers departing from India" },
      {
        key: "departure.paragraphs",
        label: "India departure card — text",
        kind: "list",
        hint: PARAGRAPHS_HINT,
        fallback: listLines([
          [
            "TripNexio processes OTB for Indian travellers when the journey is departing from India. The airline may be India-based or Gulf-based — what matters is that the passenger’s flight is departing from India. If an Indian traveller is departing from another country, TripNexio cannot update the OTB through this service, even if the airline is India- or Gulf-based.",
          ],
          [
            "OTB should be arranged before the passenger travels to the airport. TripNexio coordinates the applicable airline process and provides status updates during processing.",
          ],
        ]),
      },
      { key: "departure.networkEyebrow", label: "Airline network card — small heading", kind: "text", fallback: "Airline network" },
      { key: "departure.networkTitle", label: "Airline network card — heading", kind: "text", fallback: "Supported airlines, India departure only" },
      {
        key: "departure.networkParagraphs",
        label: "Airline network card — text",
        kind: "list",
        hint: PARAGRAPHS_HINT,
        fallback: listLines([
          ["TripNexio can coordinate OTB updates with supported India- and Gulf-based airlines where the applicable airline process is available."],
          [
            "The key limitation is the departure point: TripNexio’s OTB service can update OTB for passengers travelling from India. We cannot update OTB when the passenger is departing from another country.",
          ],
          [
            "Airline processing timelines can differ. Normal and Urgent options are shown according to the selected airline, travel date and operational availability.",
          ],
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
        hint: 'One item per line: "Item | short description".',
        fallback: listLines([
          ["Full name", "As printed on the passport"],
          ["Passport number", "For every traveller"],
          ["Mobile number", "Active contact number for updates"],
          ["Email address", "For your OTB confirmation"],
          ["Destination country", "The country you are flying to"],
          ["Airline name", "The airline you are flying with"],
          ["Travel date", "Your date of departure"],
        ]),
      },
      {
        key: "requirements.documents",
        label: "Documents Required",
        kind: "list",
        hint: 'One document per line: "Document name" (shown as Required), or "Document name | caption" to replace "Required".',
        fallback: listLines([["Passport Front Page"], ["Passport Last Page"], ["Valid Visa Copy"], ["Onward Ticket"], ["Return Ticket"]]),
      },
      {
        key: "requirements.notes",
        label: "Notes under both cards",
        kind: "list",
        hint: PARAGRAPHS_HINT,
        fallback: listLines([
          [
            "OTB is not a separate document. It is a confirmation/update made by the airline on your booking. Once the airline confirms it, we notify you by WhatsApp and email and update your status on Track Status.",
          ],
          ["Additional documents may be requested if the airline asks for them during processing."],
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
    id: "processing",
    label: "Processing time banner",
    fields: [
      { key: "processing.title", label: "Heading", kind: "text", fallback: "Processing time depends on the airline" },
      {
        key: "processing.body",
        label: "Text",
        kind: "multiline",
        fallback:
          "Normal is standard OTB processing when available; Urgent is faster processing for urgent travel when available. You’ll only see the options currently available for your selected airline and travel date, and the exact price for each before you pay.",
      },
    ],
  },
  {
    id: "returnApproval",
    label: "Need a Return Ticket? + OTB Approval cards",
    fields: [
      { key: "returnApproval.returnTitle", label: "Return Ticket card — heading", kind: "text", fallback: "Need a Return Ticket?" },
      {
        key: "returnApproval.returnBody",
        label: "Return Ticket card — text",
        kind: "multiline",
        fallback:
          "If your return ticket is missing, TripNexio can arrange a separate Return Verified Ticket and link it with the OTB journey where applicable.",
      },
      { key: "returnApproval.returnButton", label: "Return Ticket card — button", kind: "text", fallback: "Get Return Ticket" },
      { key: "returnApproval.approvalEyebrow", label: "Approval card — small heading", kind: "text", fallback: "Once approved" },
      { key: "returnApproval.approvalTitle", label: "Approval card — heading", kind: "text", fallback: "OTB Approval" },
      {
        key: "returnApproval.approvalBody",
        label: "Approval card — text",
        kind: "multiline",
        fallback:
          "Once the airline confirms your OTB, we share the confirmation/reference with you by WhatsApp and email and update the status on Track Status.",
      },
      { key: "returnApproval.importantLabel", label: "Approval card — warning label", kind: "text", fallback: "Important:" },
      {
        key: "returnApproval.importantText",
        label: "Approval card — warning text",
        kind: "multiline",
        fallback:
          "TripNexio provides OTB processing as a service provider. OTB approval does not guarantee airline boarding, immigration clearance, visa approval or entry into the destination country. Final boarding and immigration decisions remain with the relevant airline and authorities.",
      },
    ],
  },
  {
    id: "closing",
    label: "Closing banner — second button (heading and main button are edited above)",
    fields: [{ key: "closing.returnButton", label: "Return Ticket button", kind: "text", fallback: "Get Return Ticket" }],
  },
  {
    id: "faq",
    label: "FAQ section (the questions are edited in Admin → FAQs)",
    fields: [{ key: "faq.title", label: "Heading", kind: "text", fallback: "Frequently asked questions" }],
  },
];
