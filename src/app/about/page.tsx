import type { Metadata } from "next";
import { InfoPage } from "@/components/layout/InfoPage";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { getSiteContact } from "@/lib/settings/system-config";

export const metadata: Metadata = {
  title: "About Us",
  description: "TripNexio brings visa and travel services together in one simple experience for travellers worldwide.",
};

// Locked content — TripNexio_Website_Final_Company_Support_Legal_General_FAQ_23_Sep_2026.docx §2.
// The WhatsApp link follows Admin → System Configuration.
export const revalidate = 300;

export default async function AboutPage() {
  const contact = await getSiteContact();
  return (
    <InfoPage
      eyebrow="About TripNexio"
      title="Simplifying visa and travel services for travellers worldwide"
      description="TripNexio is a digital travel services platform built to make visa and travel-related processes simpler, more convenient, and accessible for travellers worldwide."
    >
      <div className="flex flex-col gap-4 text-sm leading-relaxed text-ink-secondary sm:text-base">
        <p>
          Our vision is to reduce the complexity of travel preparation by bringing essential visa and travel services
          together in one seamless online experience.
        </p>
        <p>
          Planning an international trip often involves multiple documents, requirements, timelines, and travel
          arrangements. TripNexio helps travellers navigate these requirements through a technology-driven platform
          designed to make the process clear and organized &mdash; from submitting an enquiry and required information
          to payment, document submission, processing, and status tracking.
        </p>
        <p>
          We provide visa and eVisa assistance for supported destinations worldwide, along with selected travel
          services such as OTB (OK to Board), Return Verified Ticket, Special Fare, and other supported travel
          solutions. Availability, eligibility, documentation, pricing, and processing timelines may vary depending on
          the destination, traveller&rsquo;s nationality, government or immigration requirements, airline, and
          service provider.
        </p>
        <p>
          Our focus is on simplicity, transparency, and convenience. Customers can submit their information and
          documents online, receive updates on their application or service, and access support throughout the
          process. Our operational team assists with document requirements, verification, service coordination, and
          other applicable steps.
        </p>
        <p>
          We understand that every traveller&rsquo;s journey is different. TripNexio is therefore designed with
          flexible service workflows that can accommodate different destination requirements, document checklists,
          processing timelines, pricing, and service conditions.
        </p>
        <p>
          Technology helps organize the process, while human support remains an important part of the customer
          experience. We aim to reduce unnecessary confusion, help customers understand what is required, and make
          travel-service processing more straightforward.
        </p>
        <p>
          Our vision is simple: to create a trusted digital platform where travellers can manage their visa and
          travel-service requirements in one place &mdash; with clarity, convenience, and dependable support from
          application to travel preparation.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/services">Explore Services</ButtonLink>
        <ButtonLink href={contact.whatsappHref} variant="glass">
          WhatsApp Support
        </ButtonLink>
      </div>
    </InfoPage>
  );
}
