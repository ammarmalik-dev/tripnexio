import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/LegalDocument";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How TripNexio collects, uses, stores, shares and protects personal information.",
};

// Locked content — TripNexio_Website_Final_Company_Support_Legal_General_FAQ_23_Sep_2026.docx §10.
// Effective Date: 23 September 2026.
export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      effectiveDate="23 September 2026"
      intro="This Privacy Policy explains how TripNexio collects, uses, stores, shares and protects personal information when customers visit the website, use the platform, submit an enquiry, make a booking, upload documents, make a payment or contact support."
      sections={[
        {
          heading: "1. Information we may collect",
          paragraphs: [
            "Identity and contact details such as name, mobile number, email address, date of birth and address where required for a service.",
            "Passport, visa and travel information such as passport details, nationality, visa details, travel dates, itinerary information and other data required for the selected service.",
            "Documents and images uploaded for processing, including passport pages, photographs, visa copies, tickets and other supporting documents required by the applicable service.",
            "Booking, lead, quotation, payment, invoice, refund, support and communication records.",
            "Device and technical information such as IP address, browser type, device identifiers, operating system, approximate location derived from technical information where enabled, logs and interaction information.",
            "Information received from authentication or third-party services when a customer chooses an available sign-in option, such as Google Sign-In, limited to the information made available through that sign-in flow.",
          ],
        },
        {
          heading: "2. How we use information",
          paragraphs: [
            "To create and manage enquiries, leads, bookings and service requests; verify and process information and documents; communicate with customers; provide quotations; process payments and refunds; provide status updates; prevent fraud and misuse; maintain records; improve the platform; comply with legal obligations; and perform other purposes permitted by applicable law.",
          ],
        },
        {
          heading: "3. Sensitive travel documents",
          paragraphs: [
            "Passport, visa, identity and travel documents can contain sensitive personal information. Customers should upload documents only through official TripNexio channels and should not send such documents to unverified accounts or contacts.",
          ],
        },
        {
          heading: "4. Sharing and disclosure",
          paragraphs: [
            "Information may be shared with government authorities, embassies, immigration or consular channels, airlines, airports, vendors, authorised agents, payment gateways, banks, technology providers, cloud/storage providers, communication providers, professional advisers or other processors where reasonably necessary to provide the requested service, maintain the platform, prevent fraud, or comply with law.",
            "Where services involve overseas processing, data may be transferred or accessed across borders as required to provide the service and as permitted by applicable law.",
          ],
        },
        {
          heading: "5. Payment information",
          paragraphs: [
            "Online payments may be processed through third-party payment providers. TripNexio should not store full card credentials when the payment architecture does not require it. Customers must never share card PINs, CVVs, passwords or OTPs with support staff.",
          ],
        },
        {
          heading: "6. Google Sign-In",
          paragraphs: [
            "Where Google Sign-In is enabled, Google handles authentication. TripNexio may receive account information made available as part of the sign-in flow, such as name and email address, to create or associate the customer profile. TripNexio does not receive the customer's Google password through this sign-in process.",
          ],
        },
        {
          heading: "7. Data retention",
          paragraphs: [
            "Personal information is retained only for as long as reasonably necessary for the relevant service, legal obligations, dispute resolution, security, accounting and operational recordkeeping, subject to applicable law and any service-specific retention schedule.",
            "Where a service has a published retention schedule for uploaded documents, that schedule will apply. For example, the current New Visa workflow may retain core passport/visa records after the relevant document-cleanup period while deleting other customer-uploaded documents, subject to applicable legal or operational requirements.",
          ],
        },
        {
          heading: "8. Security",
          paragraphs: [
            "TripNexio uses reasonable technical and organisational measures appropriate to the nature and risk of the information processed. No internet transmission or storage system can be guaranteed to be completely secure.",
          ],
        },
        {
          heading: "9. Customer rights and choices",
          paragraphs: [
            "Subject to applicable law and verification requirements, customers may have rights relating to access to information, correction, erasure, consent withdrawal where applicable, and grievance redressal. Requests should be sent through the official contact or grievance channel published by TripNexio.",
            "Withdrawing consent may affect TripNexio's ability to provide a service where the relevant processing is necessary to perform the requested service or comply with law.",
          ],
        },
        {
          heading: "10. Children and minors",
          paragraphs: [
            "TripNexio services may involve applications for minors, but such applications should be submitted with the required parent/guardian involvement and documentation. Where a service requires a parent/guardian, TripNexio may collect the related information needed to process the application.",
          ],
        },
        {
          heading: "11. Changes",
          paragraphs: [
            "This Privacy Policy may be updated when the platform, services, legal requirements or data practices change. The latest version will be published on the website with the updated effective date.",
          ],
        },
      ]}
    />
  );
}
