import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/LegalDocument";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms under which TripNexio processes visa and flight service requests.",
};

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms & Conditions"
      intro="These terms describe how requests made through TripNexio are handled."
      sections={[
        {
          heading: "Who we are",
          paragraphs: [
            "TripNexio is operated by TripNexio Travel Studio, Mumbai, India. We help travellers from India request visa and flight services for the UAE and other Middle East destinations.",
          ],
        },
        {
          heading: "How requests work",
          paragraphs: [
            "Submitting a request on this website does not confirm a booking or a visa. Each request is reviewed by our team, who coordinate with airlines, embassies and vendors and send you a quotation. Nothing is charged until you approve a quotation and pay.",
            "TripNexio does not offer live flight or visa booking. Availability and prices are confirmed manually by our team and can change until you pay.",
          ],
        },
        {
          heading: "Your information and documents",
          paragraphs: [
            "You are responsible for giving accurate details and valid documents. Incorrect or incomplete information can delay or cause rejection of an application, for which TripNexio is not responsible.",
          ],
        },
        {
          heading: "Decisions outside our control",
          paragraphs: [
            "Visa approvals, airline schedules, immigration decisions and vendor availability are decided by third parties. TripNexio cannot guarantee any outcome.",
          ],
        },
        {
          heading: "Payments and refunds",
          paragraphs: [
            "Payments are made through the secure payment link we send you. Refunds, where applicable, follow our Refund & Cancellation Policy and are reviewed case by case.",
          ],
        },
      ]}
    />
  );
}
