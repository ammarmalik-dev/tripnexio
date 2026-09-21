import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/LegalDocument";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What personal information TripNexio collects for your requests and how it is used.",
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      intro="How TripNexio collects and uses the information you share with us."
      sections={[
        {
          heading: "What we collect",
          paragraphs: [
            "The details you enter in a request: name, mobile number, email, passport and travel details, and any documents or passport photos you upload. If you contact us on WhatsApp, we also keep the conversation needed to process your request.",
          ],
        },
        {
          heading: "How we use it",
          paragraphs: [
            "Only to process your request: preparing quotations, applying with airlines, embassies and vendors on your behalf, sending confirmations and updates by email or WhatsApp, and issuing invoices.",
          ],
        },
        {
          heading: "Who sees it",
          paragraphs: [
            "Our staff working on your request, and the airlines, embassies and vendors that must receive your details for the service you asked for. Payments are handled by our payment provider; we don't store your card details.",
          ],
        },
        {
          heading: "Security",
          paragraphs: [
            "Access to customer records is limited to authorised staff and protected by sign-in and role-based permissions.",
          ],
        },
        {
          heading: "Your choices",
          paragraphs: [
            "You can ask us to correct or delete your information by contacting us, subject to records we must keep for a completed booking.",
          ],
        },
      ]}
    />
  );
}
