import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/LegalDocument";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description: "How refunds and cancellations are handled for TripNexio services.",
};

// Locked content — TripNexio_Website_Final_Company_Support_Legal_General_FAQ_23_Sep_2026.docx §11.
// Effective Date: 23 September 2026. The per-service figures here (₹250, 4-hour window)
// mirror the same locked business rules already enforced server-side in src/lib/refunds/rules.ts —
// keep both in sync if that ever changes.
export default function RefundPolicyPage() {
  return (
    <LegalDocument
      title="Refund & Cancellation Policy"
      effectiveDate="23 September 2026"
      intro="Refund eligibility depends on the service purchased, processing stage, payment status, third-party charges and the service-specific terms displayed before payment. A customer should review the applicable service terms before completing payment."
      sections={[
        {
          heading: "General rule",
          paragraphs: [
            "A refund is processed only where the applicable service terms allow it. Refunds may be reduced by disclosed gateway charges, processing charges or non-refundable third-party amounts where permitted.",
          ],
        },
        {
          heading: "New Visa",
          paragraphs: [
            "Current workflow rule: within 4 hours, eligible for full refund less applicable gateway charges; after documents have been validated, refund less ₹250 plus applicable gateway charges; after embassy submission, no refund. Where submission cannot proceed because of a duplicate/similar prior submission issue, refund less ₹250 plus applicable gateway charges, subject to applicable rules.",
          ],
        },
        {
          heading: "Visa Extension",
          paragraphs: [
            "Current workflow rule: a request marked Not Accepted is eligible for payment less applicable gateway charges; a request marked Rejected is not refundable under the current workflow, subject to applicable law and any service-specific terms.",
          ],
        },
        {
          heading: "Visa Change",
          paragraphs: [
            "Current workflow rule: before the package is generated, refund less ₹250 plus applicable gateway charges; after the package is generated, no refund under the current workflow, subject to applicable law and service terms.",
          ],
        },
        {
          heading: "Special Fare",
          paragraphs: [
            "Because Special Fare is an offline/manual quotation workflow, availability can change after payment. Where the final fare is higher, the customer may be asked to pay the difference or may choose an eligible alternative/refund path. Where the final fare is lower, the applicable difference may be refunded. If no suitable alternative can be provided, the applicable payment may be refunded subject to the service terms and any non-refundable charges.",
          ],
        },
        {
          heading: "OTB / Return Verified Ticket",
          paragraphs: [
            "Refunds are governed by the booking stage, ticket/processing status, airline/vendor rules and the service-specific terms shown at purchase. Customers should not assume that a request can be cancelled once processing or issuance has begun.",
          ],
        },
        {
          heading: "Additional charges",
          paragraphs: [
            "Any additional amount approved or paid against the same Booking ID will be governed by the applicable service terms and may have separate refund treatment depending on what work has already been performed.",
          ],
        },
        {
          heading: "Payment reversals and failed transactions",
          paragraphs: [
            "If money is debited but the service is not confirmed, TripNexio will verify the gateway status. Failed, reversed or duplicate transactions may be resolved through the payment provider and may take additional banking time.",
          ],
        },
        {
          heading: "Refund method",
          paragraphs: [
            "Approved refunds are normally sent back through the original payment method or another lawful method communicated by TripNexio. Bank/gateway processing times are outside TripNexio's direct control.",
          ],
        },
        {
          heading: "Important",
          paragraphs: [
            "Where the government, embassy, airline, payment provider or another third party changes a requirement, rejects a transaction, cancels availability or creates a new charge, the refund outcome will be determined by the applicable service terms and the nature of the third-party action. Nothing in this policy limits any mandatory consumer rights under applicable law.",
          ],
        },
      ]}
    />
  );
}
