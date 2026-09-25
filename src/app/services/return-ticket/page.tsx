import type { Metadata } from "next";
import { TicketCheck, Clock, ClipboardList, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradientMesh } from "@/components/motion/GradientMesh";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { utilityLinks } from "@/lib/nav-config";
import { VisaProcessSteps } from "@/components/services/VisaProcessSteps";

export const metadata: Metadata = {
  title: "Return Verified Ticket",
  description:
    "A verifiable return ticket reservation for international travel. Share your destination and travel date — we take care of the rest.",
};

const whatYoullNeed = ["Full name, mobile number, email", "Number of passengers", "Travel date", "Expected return date"];

// Locked content — doc §8 "How It Works — final customer copy" (5 steps).
// "airline/vendor" in the source doc kept as "airline/partner" — the
// client's own site-wide Sep 24 wording instruction (Vendor -> Partner)
// takes precedence over this doc's literal wording.
const visaProcessSteps = [
  { step: "01", headline: "Share your travel details", supportingCopy: "Tell us your destination, number of passengers and travel date." },
  { step: "02", headline: "We work out the return date", supportingCopy: "We arrange an approximate return date based on available ticket options and your travel schedule." },
  { step: "03", headline: "Complete payment", supportingCopy: "Review the summary and applicable terms, then complete payment." },
  { step: "04", headline: "We arrange your return ticket reservation", supportingCopy: "Our team processes the return ticket through the configured airline/partner process based on live availability." },
  { step: "05", headline: "Receive your return ticket", supportingCopy: "Once issued, your return ticket is delivered to you." },
];

export default function ReturnTicketLandingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <GradientMesh />
        <Container className="relative flex flex-col items-center gap-6 py-20 text-center sm:py-28">
          <MotionReveal>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <TicketCheck className="h-6 w-6" aria-hidden="true" />
            </span>
          </MotionReveal>
          <MotionReveal delay={0.04}>
            <span className="text-sm font-medium tracking-wide text-ink-accent uppercase">International Return Ticket</span>
          </MotionReveal>
          <MotionReveal delay={0.06}>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink-heading sm:text-5xl">
              Return Ticket, Made Simple
            </h1>
          </MotionReveal>
          <MotionReveal delay={0.12}>
            <p className="max-w-xl text-base text-ink-secondary sm:text-lg">
              Get a verifiable return ticket reservation for international travel. Share your destination and
              travel date — we take care of the rest.
            </p>
          </MotionReveal>
          <MotionReveal delay={0.18}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/services/return-ticket/request" variant="primary" size="lg">
                Reserve Your Ticket
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
              <SectionHeading eyebrow="How the return date works" title="You give a target, not an exact date" />
              <p className="text-sm text-ink-secondary sm:text-base">
                You tell us your travel date and your expected return date. We then aim to issue a return ticket
                close to that date, based on live ticket and partner availability — the exact issue date isn&apos;t
                something you need to work out yourself.
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
                Ready to reserve your return ticket?
              </h2>
              <ButtonLink href="/services/return-ticket/request" variant="primary" size="lg">
                Reserve Your Ticket
              </ButtonLink>
            </div>
          </MotionReveal>
        </Container>
      </section>
    </>
  );
}
