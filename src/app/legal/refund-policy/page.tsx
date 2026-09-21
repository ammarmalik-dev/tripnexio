import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/LegalDocument";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description: "How refunds and cancellations are handled for TripNexio services.",
};

export default function RefundPolicyPage() {
  return (
    <LegalDocument
      title="Refund & Cancellation Policy"
      intro="How cancellations and refunds are handled once you have paid."
      sections={[
        {
          heading: "General approach",
          paragraphs: [
            "Refunds depend on the service and on how far your request has progressed. Once your details or documents have been forwarded to an airline, embassy or vendor, the work is underway and charges paid to them may not be recoverable.",
          ],
        },
        {
          heading: "How a refund is calculated",
          paragraphs: [
            "A refund is the amount you paid minus any applicable cancellation charge and payment-gateway charge. Our team raises the refund and an administrator approves it before it is processed.",
          ],
        },
        {
          heading: "How to ask for one",
          paragraphs: [
            "Contact us on WhatsApp or by email with your reference number as soon as you know you want to cancel. Earlier requests are more likely to qualify for a larger refund.",
          ],
        },
        {
          heading: "Refund timing",
          paragraphs: [
            "Approved refunds are returned to the original payment method. The time it takes to appear depends on your bank or card issuer.",
          ],
        },
      ]}
    />
  );
}
