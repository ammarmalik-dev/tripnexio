import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/LegalDocument";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms governing access to and use of the TripNexio website and supported travel-related services.",
};

// Locked content — TripNexio_Website_Final_Company_Support_Legal_General_FAQ_23_Sep_2026.docx §9.
// Effective Date: 23 September 2026. Do not paraphrase — this is client-locked legal text,
// pending final legal counsel review before publication (see that doc's "Publication gate").
export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms & Conditions"
      effectiveDate="23 September 2026"
      intro="These Terms & Conditions govern access to and use of the TripNexio website, digital platform and supported travel-related services. By accessing the website, submitting a request, making a payment or using a service, the customer agrees to these Terms and the policies referenced in them."
      sections={[
        {
          heading: "1. About the platform",
          paragraphs: [
            "TripNexio is a consumer-facing digital platform for supported visa/eVisa and travel-related services. The platform may provide information, application workflows, document collection, customer support, status tracking, payment processing, quotations and coordination with relevant service providers.",
          ],
        },
        {
          heading: "2. Service availability",
          paragraphs: [
            "Not every destination, nationality, traveller profile or service is available at all times. TripNexio may add, suspend, change or discontinue services, service areas, pricing or processing options based on operational, regulatory or provider requirements.",
          ],
        },
        {
          heading: "3. Customer responsibility",
          paragraphs: [
            "The customer must provide accurate, complete and current information and genuine documents. The customer is responsible for reviewing names, passport details, dates, travel information, contact details and other submitted information before confirmation.",
            "Customers must not submit forged, altered, misleading, expired or otherwise invalid documents or information. TripNexio may pause, reject or cancel processing where information appears incomplete, inconsistent or unsuitable for the selected service.",
          ],
        },
        {
          heading: "4. Government, embassy, airline and third-party decisions",
          paragraphs: [
            "Visa approval, immigration decisions, entry decisions, airline requirements, ticket inventory, border decisions and other regulatory outcomes are controlled by the relevant authority, airline, vendor or service provider. TripNexio cannot guarantee any such outcome unless expressly stated in writing for a specific service.",
          ],
        },
        {
          heading: "5. Processing times",
          paragraphs: [
            "Any processing time shown is an estimate or service-specific configured timeframe unless expressly stated otherwise. Delays can occur because of government/embassy processing, document requests, holidays, airline operations, vendor capacity, payment-provider issues, technology incidents or other factors outside reasonable control.",
          ],
        },
        {
          heading: "6. Quotations and payments",
          paragraphs: [
            "Where a quotation is provided, the quotation is valid only for the period stated on it. For Special Fare and other quotation-driven workflows, the applicable service page or quotation may specify a short validity period. A customer should complete payment within the stated validity to preserve the quoted terms, subject to availability and final confirmation.",
            "An amount paid through the platform may include service charges, government/third-party charges, gateway charges, taxes where applicable, and other disclosed amounts. Applicable amounts will be shown at or before payment as required.",
          ],
        },
        {
          heading: "7. Additional requests or charges",
          paragraphs: [
            "If a government authority, airline, vendor or service workflow requires an additional document, service step or disclosed charge, TripNexio may request the required action or payment. Additional charges, where applicable, will be communicated and linked to the relevant booking/reference.",
          ],
        },
        {
          heading: "8. Refunds and cancellations",
          paragraphs: [
            "Refund eligibility is governed by the Refund & Cancellation Policy and any service-specific terms displayed before payment. A refund may be reduced by applicable gateway charges, processing charges or non-refundable third-party amounts where permitted and disclosed.",
          ],
        },
        {
          heading: "9. Communication",
          paragraphs: [
            "Customers are responsible for providing an active mobile number and email address and for checking TripNexio messages relating to their service. Delays resulting from non-response or failure to provide requested documents may affect processing.",
          ],
        },
        {
          heading: "10. Account and authentication",
          paragraphs: [
            "Where account or authentication features are enabled, customers must keep their login credentials secure. Where Google Sign-In is offered, authentication is performed through Google. Customers must not share passwords, OTPs or other authentication secrets with another person.",
          ],
        },
        {
          heading: "11. Prohibited use",
          paragraphs: [
            "Customers must not use the platform for unlawful activity, fraud, impersonation, document falsification, unauthorised access, interference with platform operations, scraping intended to bypass access controls, or any activity that may harm TripNexio, other users or service providers.",
          ],
        },
        {
          heading: "12. Intellectual property",
          paragraphs: [
            "The TripNexio name, platform design, software, content, graphics, workflows, trademarks and other intellectual property belong to TripNexio or its licensors, unless stated otherwise. Customers may use the platform for personal, lawful service-related purposes only.",
          ],
        },
        {
          heading: "13. Privacy",
          paragraphs: [
            "Personal information is handled in accordance with the TripNexio Privacy Policy and Cookie Policy, together with applicable data-protection law.",
          ],
        },
        {
          heading: "14. Force majeure and external events",
          paragraphs: [
            "TripNexio is not responsible for delays or service disruption caused by events beyond reasonable control, including government action, regulatory changes, strikes, natural disasters, public emergencies, airline or provider disruptions, network failures, payment-system failures, cyber incidents not reasonably preventable, or other comparable events.",
          ],
        },
        {
          heading: "15. Suspension or termination",
          paragraphs: [
            "TripNexio may restrict or suspend access where reasonably necessary for security, fraud prevention, legal compliance, misuse, non-payment, or material breach of these Terms. This does not remove rights that cannot lawfully be excluded.",
          ],
        },
        {
          heading: "16. Limitation and applicable law",
          paragraphs: [
            "To the extent permitted by applicable law, TripNexio will be responsible only for losses directly attributable to its own proven failure to perform the service as agreed. Nothing in these Terms excludes or limits liability that cannot lawfully be excluded.",
            "These Terms are intended to be governed by the laws of India. The competent courts/authorities at [jurisdiction to be confirmed] will have jurisdiction, subject to applicable consumer and other mandatory legal remedies.",
          ],
        },
        {
          heading: "17. Updates",
          paragraphs: [
            "TripNexio may update these Terms from time to time. The updated version will be posted on the website with a revised effective date where appropriate.",
          ],
        },
      ]}
    />
  );
}
