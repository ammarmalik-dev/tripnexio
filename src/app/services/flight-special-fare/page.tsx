import type { Metadata } from "next";
import { Plane, Clock, ClipboardList, CheckCircle2, BadgePercent } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradientMesh } from "@/components/motion/GradientMesh";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { utilityLinks } from "@/lib/nav-config";
import { VisaProcessSteps } from "@/components/services/VisaProcessSteps";
import { ServiceFaqSection } from "@/components/services/ServiceFaqSection";
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
  FareFollowUpNote,
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

// Doc §15 follow-up fallback ("every 7 days") when no Admin Timeline config exists.
const DOC_FOLLOW_UP_INTERVAL_DAYS = 7;

// Locked content — doc §5 "What You'll Need".
const whatYoullNeed = [
  { title: "Full name", detail: "Passenger/customer name" },
  { title: "Mobile number", detail: "Active contact number" },
  { title: "Email address", detail: "For quote and booking updates" },
  { title: "Departure city / airport", detail: "Where you want to travel from" },
  { title: "Destination city / airport", detail: "Where you want to travel to" },
  { title: "Travel date", detail: "Your planned date of travel" },
  { title: "Passenger details", detail: "Adults, children and infants where applicable" },
];

interface FlightLandingConfig {
  quoteValidityMinutes: number;
  followUpIntervalDays: number;
}

/**
 * Admin-configurable values the doc calls out (quote validity, follow-up
 * interval). Mirrors validity-cap.ts: the Timeline config's
 * quotationResponseMinutes overrides FLIGHT_QUOTE_MAX_VALIDITY_MINUTES.
 * Any DB failure falls back to the doc's own figures rather than failing the page.
 */
async function loadFlightLandingConfig(): Promise<FlightLandingConfig> {
  try {
    const rules = await getServiceTimelineRules("FLIGHT_SPECIAL_FARE");
    return {
      quoteValidityMinutes: rules.quotationResponseMinutes ?? FLIGHT_QUOTE_MAX_VALIDITY_MINUTES,
      followUpIntervalDays: rules.followUpIntervalDays ?? DOC_FOLLOW_UP_INTERVAL_DAYS,
    };
  } catch (error) {
    console.error("[flight-special-fare] could not load timeline config", error);
    return {
      quoteValidityMinutes: FLIGHT_QUOTE_MAX_VALIDITY_MINUTES,
      followUpIntervalDays: DOC_FOLLOW_UP_INTERVAL_DAYS,
    };
  }
}

// Locked content — doc §7 "How It Works — final reference-style copy" (7 steps).
const visaProcessSteps = [
  { step: "01", headline: "Share your trip details", supportingCopy: "Tell us your departure, destination, travel date and passenger details." },
  { step: "02", headline: "We check available fares", supportingCopy: "Our team checks special inventory, group-sourced fares and regular offline fares through airline, agency and partner sources." },
  { step: "03", headline: "Receive your options", supportingCopy: "We send available flight options with airline, timings, baggage and fare details." },
  { step: "04", headline: "Choose your fare", supportingCopy: "Select the option you prefer while the quotation is valid." },
  { step: "05", headline: "Complete payment", supportingCopy: "Review the flight details and applicable terms, then complete payment." },
  { step: "06", headline: "We reconfirm availability", supportingCopy: "After payment, our team confirms the final seat and fare availability." },
  { step: "07", headline: "Ticket issued", supportingCopy: "Once confirmed, your flight ticket is issued and delivered." },
];

export default async function FlightSpecialFareLandingPage() {
  const config = await loadFlightLandingConfig();
  return (
    <>
      <section className="relative overflow-hidden">
        <GradientMesh />
        <Container className="relative flex flex-col items-center gap-6 py-20 text-center sm:py-28">
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
            <p className="text-sm font-medium text-ink-tertiary">Domestic + Worldwide · Discounted Special Fares · Multiple Flight Options</p>
          </MotionReveal>
          <MotionReveal delay={0.18}>
            <div className="flex flex-wrap items-center justify-center gap-3">
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

      <section className="py-16 sm:py-20">
        <Container className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
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

      <section className="py-16 sm:py-20">
        <Container>
          <MotionReveal>
            <GlassCard tier={2} className="flex flex-col gap-6 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <ClipboardList className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-sm font-medium tracking-wide text-ink-accent uppercase">What you&rsquo;ll need</h2>
              </div>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {whatYoullNeed.map((item) => (
                  <li key={item.title} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold text-ink-heading">{item.title}</span>
                      <span className="text-sm text-ink-secondary">{item.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-hairline pt-4 text-sm font-medium text-ink-tertiary">
                Current request window: up to 45 days before travel.
              </p>
            </GlassCard>
          </MotionReveal>
        </Container>
      </section>

      <PassengerTypes />

      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-12">
          <MotionReveal>
            <SectionHeading align="center" eyebrow="Simple steps" title="How it works" className="mx-auto" />
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
      <FareFollowUpNote intervalDays={config.followUpIntervalDays} />

      <ServiceFaqSection serviceType="FLIGHT_SPECIAL_FARE" />

      <section className="pb-20 sm:pb-28">
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
