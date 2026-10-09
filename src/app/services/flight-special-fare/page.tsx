import type { Metadata } from "next";
import { Plane, Clock, BadgePercent, MapPinned, SearchCheck, CreditCard, Ticket } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { GlassCard } from "@/components/ui/GlassCard";
import { ServiceHeroBackdrop } from "@/components/services/ServiceHeroBackdrop";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { utilityLinks } from "@/lib/nav-config";
import { VisaProcessSteps } from "@/components/services/VisaProcessSteps";
import { ServiceFaqSection } from "@/components/services/ServiceFaqSection";
import { ServiceRequirementsSection } from "@/components/services/ServiceRequirementsSection";
import { FareSourceCards } from "@/components/services/flight-special-fare/landing/FareSourceCards";
import { PassengerTypes } from "@/components/services/flight-special-fare/landing/PassengerTypes";
import {
  MultipleOptionsSection,
  QuoteValiditySection,
} from "@/components/services/flight-special-fare/landing/QuoteOptionsSections";
import {
  AlternativeRouteSection,
  AfterPaymentSection,
} from "@/components/services/flight-special-fare/landing/AlternativeAndPaymentSections";
import {
  BaggageAndRefundSection,
  TicketDeliverySection,
} from "@/components/services/flight-special-fare/landing/TicketingSections";
import { getServiceTimelineRules } from "@/lib/settings/service-timeline-config";
import { FLIGHT_QUOTE_MAX_VALIDITY_MINUTES } from "@/lib/quotations/pricing";

export const metadata: Metadata = {
  title: "Flight Special Fare",
  description:
    "Offline special fare flight bookings through our airline and partners for major domestic cities in India and destinations worldwide. Submit your trip details online and our team confirms availability.",
};

// Re-render at most every 5 minutes so Admin config/FAQ edits show up without a redeploy.
export const revalidate = 300;

// Locked content — doc §5 "What You'll Need".
const whatYoullNeed = [
  { label: "Full name", detail: "Passenger/customer name" },
  { label: "Mobile number", detail: "Active contact number" },
  { label: "Email address", detail: "For quote and booking updates" },
  { label: "Departure city / airport", detail: "Where you want to travel from" },
  { label: "Destination city / airport", detail: "Where you want to travel to" },
  { label: "Travel date", detail: "Your planned date of travel" },
  { label: "Passenger details", detail: "Adults, children and infants where applicable" },
  // Client testing 2026-10-09 (B6) — the client's two extra lines, verbatim.
  { label: "Passport / Government ID", detail: "Required for international travel; valid government ID may be used for domestic travel." },
  { label: "Visa Copy", detail: "Required only when applicable for the destination." },
];

// Client correction 2026-10-05: passport required, visa copy optional (may be asked before payment).
const documentsRequired = [
  { name: "Passport Copy", required: true, caption: "Required for every passenger" },
  { name: "Visa Copy", required: false, caption: "Optional, may be requested before payment" },
];

interface FlightLandingConfig {
  quoteValidityMinutes: number;
}

/**
 * Admin-configurable quote validity (the customer-facing follow-up note was
 * removed, client correction 2026-10-05: it is an internal CRM workflow). Mirrors validity-cap.ts: the Timeline config's
 * quotationResponseMinutes overrides FLIGHT_QUOTE_MAX_VALIDITY_MINUTES.
 * Any DB failure falls back to the doc's own figures rather than failing the page.
 */
async function loadFlightLandingConfig(): Promise<FlightLandingConfig> {
  try {
    const rules = await getServiceTimelineRules("FLIGHT_SPECIAL_FARE");
    return {
      quoteValidityMinutes: rules.quotationResponseMinutes ?? FLIGHT_QUOTE_MAX_VALIDITY_MINUTES,
    };
  } catch (error) {
    console.error("[flight-special-fare] could not load timeline config", error);
    return {
      quoteValidityMinutes: FLIGHT_QUOTE_MAX_VALIDITY_MINUTES,
    };
  }
}

// Client correction 2026-10-05 — "How It Works" is exactly 4 steps across every service.
const visaProcessSteps = [
  { step: "01", icon: MapPinned, headline: "Share Your Trip Details", supportingCopy: "Tell us your departure, destination, travel date and passenger details." },
  { step: "02", icon: SearchCheck, headline: "We Check & Share Available Fares", supportingCopy: "Our team checks available fares and sends you flight options with airline, timings, baggage and fare details." },
  { step: "03", icon: CreditCard, headline: "Choose Your Fare & Pay", supportingCopy: "Select your preferred option while the quotation is valid and complete payment." },
  { step: "04", icon: Ticket, headline: "We Reconfirm & Issue Your Ticket", supportingCopy: "After payment, we reconfirm final availability. Once confirmed, your ticket is issued and delivered." },
];

export default async function FlightSpecialFareLandingPage() {
  const config = await loadFlightLandingConfig();
  return (
    <>
      <section className="relative overflow-hidden">
        <ServiceHeroBackdrop service="FLIGHT_SPECIAL_FARE" />
        <Container className="relative flex flex-col items-center gap-6 py-14 text-center sm:py-20">
          <MotionReveal>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <Plane className="h-6 w-6" aria-hidden="true" />
            </span>
          </MotionReveal>
          <MotionReveal delay={0.04}>
            <span className="text-sm font-medium tracking-wide text-ink-accent uppercase">Flight Special Fare</span>
          </MotionReveal>
          <MotionReveal delay={0.06}>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink-heading sm:text-5xl">
              Special Fares, Made Simple
            </h1>
          </MotionReveal>
          <MotionReveal delay={0.12}>
            <p className="max-w-xl text-base text-ink-secondary sm:text-lg">
              Offline special fares sourced through our airline and partners for major domestic cities in India
              and destinations worldwide. Share your route, travel date and passenger details — our team checks
              available airline and agency inventory and sends you the best available options.
            </p>
          </MotionReveal>
          <MotionReveal delay={0.15}>
            <ul className="flex flex-wrap items-center justify-center gap-2 text-sm font-medium text-ink-secondary">
              {["Domestic + Worldwide", "Discounted Special Fares", "Multiple Flight Options"].map((label) => (
                <li key={label} className="rounded-full border border-hairline bg-surface-1/80 px-3 py-1">
                  {label}
                </li>
              ))}
            </ul>
          </MotionReveal>
          <MotionReveal delay={0.18}>
            <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
              <ButtonLink href="/services/flight-special-fare/request" variant="primary" size="lg">
                Request a Fare Quote
              </ButtonLink>
              <ButtonLink href={utilityLinks.trackStatus.href} variant="glass" size="lg">
                Track Status
              </ButtonLink>
            </div>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-10 sm:py-14">
        <Container className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <MotionReveal>
            <div className="flex flex-col gap-4">
              <SectionHeading eyebrow="What is a special fare?" title="Discounted fares sourced for your trip" />
              <p className="text-sm text-ink-secondary sm:text-base">
                TripNexio works with airlines, agencies and partners to source special flight inventory. For selected
                routes and travel dates, this can include group or pre-purchased inventory secured in advance, allowing
                us to offer discounted fares when that inventory is available.
              </p>
              <p className="text-sm text-ink-secondary sm:text-base">
                When special inventory is not available, our team can also check regular offline fares through our
                airline and agency relationships.
              </p>
            </div>
          </MotionReveal>
          <MotionReveal delay={0.08}>
            <GlassCard tier={2} className="flex items-start gap-4 p-6 sm:p-8">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <BadgePercent className="h-6 w-6" aria-hidden="true" />
              </span>
              <p className="text-sm text-ink-secondary sm:text-base">
                Fare advantage depends on route, date, inventory, passenger type and supplier availability.
              </p>
            </GlassCard>
          </MotionReveal>
        </Container>
      </section>

      <FareSourceCards />

      <ServiceRequirementsSection
        whatYouNeed={whatYoullNeed}
        documents={documentsRequired}
        notes={["Current request window: up to 45 days before travel."]}
      />

      <PassengerTypes />

      <section className="py-10 sm:py-14">
        <Container className="flex flex-col gap-8">
          <MotionReveal>
            <SectionHeading align="center" eyebrow="Simple steps" title="How It Works" className="mx-auto" />
          </MotionReveal>
          <VisaProcessSteps steps={visaProcessSteps} />
        </Container>
      </section>

      <MultipleOptionsSection />
      <QuoteValiditySection validityMinutes={config.quoteValidityMinutes} />
      <AlternativeRouteSection />
      <AfterPaymentSection />
      <BaggageAndRefundSection />
      <TicketDeliverySection />

      <ServiceFaqSection serviceType="FLIGHT_SPECIAL_FARE" />

      <section className="pb-14 sm:pb-20">
        <Container>
          <MotionReveal>
            <div className="surface-dark-block flex flex-col items-center gap-6 rounded-xl p-8 text-center sm:p-12">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-ink-on-dark-primary">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-ink-on-dark-primary sm:text-3xl">
                Ready to check special fares for your trip?
              </h2>
              <ButtonLink href="/services/flight-special-fare/request" variant="primary" size="lg">
                Request a Fare Quote
              </ButtonLink>
            </div>
          </MotionReveal>
        </Container>
      </section>
    </>
  );
}
