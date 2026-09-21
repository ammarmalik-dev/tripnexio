import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/LegalDocument";

export const metadata: Metadata = {
  title: "Disclaimer",
  description: "Important limits on what TripNexio can promise about visas, flights and travel decisions.",
};

export default function DisclaimerPage() {
  return (
    <LegalDocument
      title="Disclaimer"
      intro="Please read this before relying on any information or estimate on this website."
      sections={[
        {
          heading: "Not a live booking engine",
          paragraphs: [
            "Prices and availability shown on this website are indicative. A service is only confirmed when our team sends you a quotation and you approve and pay for it.",
          ],
        },
        {
          heading: "Third-party decisions",
          paragraphs: [
            "Visa approvals and rejections, airline schedules, denied boarding, cancellations, rescheduling and immigration decisions are made by airlines, embassies, immigration authorities and vendors, not by TripNexio.",
          ],
        },
        {
          heading: "Your responsibility",
          paragraphs: [
            "You are responsible for meeting airline, visa and immigration requirements for your trip, and for the accuracy of the information and documents you provide.",
          ],
        },
      ]}
    />
  );
}
