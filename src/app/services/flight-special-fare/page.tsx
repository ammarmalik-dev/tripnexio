import type { Metadata } from "next";
import { Plane, ShieldCheck, Clock, ClipboardList, Users, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradientMesh } from "@/components/motion/GradientMesh";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { utilityLinks } from "@/lib/nav-config";

export const metadata: Metadata = {
  title: "Flight Special Fare",
  description:
    "Offline special fare flight bookings through our airline and partner network for India to UAE/GCC travel. Submit your trip details online and our team confirms availability.",
};

const whatYoullNeed = [
  "Full name, mobile number, email",
  "Departure and arrival city/airport",
  "Travel date (and return date, if any)",
  "Each passenger's date of birth",
];

const howItWorks = [
  {
    title: "Share your trip details",
    description: "Route, travel date, and passengers — requests are accepted up to 45 days ahead of travel.",
    icon: ClipboardList,
  },
  {
    title: "We check special fare availability",
    description: "Our team checks offline special fares with our airline and partner network — no live search.",
    icon: ShieldCheck,
  },
  {
    title: "Review and confirm your quote",
    description: "You get a fare quote valid for a limited time, with fares by passenger type — Adult, Child, Infant.",
    icon: Users,
  },
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
          <MotionReveal delay={0.06}>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink-heading sm:text-5xl">
              Flight Special Fare
            </h1>
          </MotionReveal>
          <MotionReveal delay={0.12}>
            <p className="max-w-xl text-base text-ink-secondary sm:text-lg">
              Offline special fares sourced through our airline and partner relationships for India to UAE/GCC
              travel. Share your trip details — our team checks availability and sends you a fare quote.
            </p>
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
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {howItWorks.map((step, index) => {
              const Icon = step.icon;
              return (
                <MotionReveal key={step.title} delay={index * 0.08}>
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <p className="text-sm font-semibold text-ink-heading">{step.title}</p>
                    <p className="max-w-xs text-xs text-ink-tertiary">{step.description}</p>
                  </div>
                </MotionReveal>
              );
            })}
          </div>
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
