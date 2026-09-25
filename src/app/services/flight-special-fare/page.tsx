import type { Metadata } from "next";
import { Plane, Clock, ClipboardList, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradientMesh } from "@/components/motion/GradientMesh";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { utilityLinks } from "@/lib/nav-config";
import { VisaProcessSteps } from "@/components/services/VisaProcessSteps";

export const metadata: Metadata = {
  title: "Flight Special Fare",
  description:
    "Offline special fare flight bookings through our airline and partners for major domestic cities in India and destinations worldwide. Submit your trip details online and our team confirms availability.",
};

const whatYoullNeed = [
  "Full name, mobile number, email",
  "Departure and arrival city/airport",
  "Travel date (and return date, if any)",
  "Each passenger's date of birth",
];

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

export default function FlightSpecialFareLandingPage() {
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
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <MotionReveal>
            <div className="flex flex-col gap-4">
              <SectionHeading eyebrow="How fares work" title="Fares are checked, not searched live" />
              <p className="text-sm text-ink-secondary sm:text-base">
                There&apos;s no live fare search or public inventory here — our team manually checks offline special
                fare availability with our airline and partner network, then sends you a quote valid for a limited time.
                Fares vary by passenger type, calculated automatically from each traveler&apos;s date of birth.
              </p>
            </div>
          </MotionReveal>

          <MotionReveal delay={0.08}>
            <GlassCard tier={2} className="flex flex-col gap-4 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <ClipboardList className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-base font-semibold text-ink-heading">What you&rsquo;ll need</p>
              </div>
              <ul className="flex flex-col gap-2.5">
                {whatYoullNeed.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-ink-secondary">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </GlassCard>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-12">
          <MotionReveal>
            <SectionHeading align="center" eyebrow="Simple steps" title="How it works" className="mx-auto" />
          </MotionReveal>
          <VisaProcessSteps steps={visaProcessSteps} />
        </Container>
      </section>

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
