import type { Metadata } from "next";
import { ArrowLeftRight, Clock } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ServiceHeroBackdrop } from "@/components/services/ServiceHeroBackdrop";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { utilityLinks } from "@/lib/nav-config";
import { VisaProcessSteps } from "@/components/services/VisaProcessSteps";
import { ServiceFaqSection } from "@/components/services/ServiceFaqSection";
import { VisaChangeOverview } from "@/components/services/visa-change/landing/VisaChangeOverview";
import { VisaChangeMethods } from "@/components/services/visa-change/landing/VisaChangeMethods";
import { VisaChangeRequirements } from "@/components/services/visa-change/landing/VisaChangeRequirements";
import { VisaChangePricingSection } from "@/components/services/visa-change/landing/VisaChangePricingSection";
import { VisaChangeConfirmedOptions } from "@/components/services/visa-change/landing/VisaChangeConfirmedOptions";
import { VisaChangeAfterBooking } from "@/components/services/visa-change/landing/VisaChangeAfterBooking";

// Admin-managed pricing + FAQs are read at render; refresh every 5 minutes.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Visa Change",
  description:
    "Change your UAE visa status — Airport-to-Airport or Border Exit, confirmed by our team. Submit your details online and we handle the rest.",
};

// Locked content — doc §11 "How It Works — final reference-style copy" (7 steps).
// "sponsor/vendor" in the source doc's step 02 kept as "sponsor/partner" — the
// client's own site-wide Sep 24 wording instruction (Vendor -> Partner)
// takes precedence over this doc's literal wording.
const visaProcessSteps = [
  { step: "01", headline: "Start your application", supportingCopy: "Choose A2A or Border Exit and enter your traveller details." },
  { step: "02", headline: "We check availability", supportingCopy: "Our team checks the available sponsor/partner arrangements." },
  { step: "03", headline: "Choose your confirmed option", supportingCopy: "Once availability is confirmed, you can select the available date, time and package." },
  { step: "04", headline: "Complete payment", supportingCopy: "Review the package, terms and final price, then make payment." },
  { step: "05", headline: "Complete your Visa Change", supportingCopy: "Receive the confirmed travel/exit details and follow the instructions provided." },
  { step: "06", headline: "Exit completed", supportingCopy: "Our team records the completed exit and starts the next stage." },
  { step: "07", headline: "New Visa Processing", supportingCopy: "The new visa application proceeds and the visa is delivered once approved." },
];

export default function VisaChangeLandingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <ServiceHeroBackdrop service="VISA_CHANGE" />
        <Container className="relative flex flex-col items-center gap-6 py-20 text-center sm:py-28">
          <MotionReveal>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <ArrowLeftRight className="h-6 w-6" aria-hidden="true" />
            </span>
          </MotionReveal>
          <MotionReveal delay={0.04}>
            <span className="text-sm font-medium tracking-wide text-ink-accent uppercase">UAE Visa Change</span>
          </MotionReveal>
          <MotionReveal delay={0.06}>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink-heading sm:text-5xl">
              Visa Change, Made Simple
            </h1>
          </MotionReveal>
          <MotionReveal delay={0.12}>
            <p className="max-w-xl text-base text-ink-secondary sm:text-lg">
              Change your UAE visa from inside the UAE through a simple, guided process. Choose Airport-to-Airport
              or Border Exit, submit your details, and let TripNexio coordinate the next steps for you.
            </p>
          </MotionReveal>
          <MotionReveal delay={0.18}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/services/visa-change/request" variant="primary" size="lg">
                Start Visa Change
              </ButtonLink>
              <ButtonLink href={utilityLinks.trackStatus.href} variant="glass" size="lg">
                Track Status
              </ButtonLink>
            </div>
          </MotionReveal>
        </Container>
      </section>

      <VisaChangeOverview />
      <VisaChangeMethods />
      <VisaChangeRequirements />
      <VisaChangePricingSection />

      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-12">
          <MotionReveal>
            <SectionHeading align="center" eyebrow="Simple steps" title="How it works" className="mx-auto" />
          </MotionReveal>
          <VisaProcessSteps steps={visaProcessSteps} />
        </Container>
      </section>

      <VisaChangeConfirmedOptions />
      <VisaChangeAfterBooking />

      <ServiceFaqSection serviceType="VISA_CHANGE" />

      <section className="pb-20 sm:pb-28">
        <Container>
          <MotionReveal>
            <div className="surface-dark-block flex flex-col items-center gap-6 rounded-xl p-8 text-center sm:p-12">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-ink-on-dark-primary">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-ink-on-dark-primary sm:text-3xl">
                Ready to change your visa?
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <ButtonLink href="/services/visa-change/request" variant="primary" size="lg">
                  Start Visa Change
                </ButtonLink>
                <ButtonLink
                  href={utilityLinks.trackStatus.href}
                  variant="ghost"
                  size="lg"
                  className="border-white/40 text-white hover:border-white/70 hover:bg-white/5"
                >
                  Track Status
                </ButtonLink>
              </div>
            </div>
          </MotionReveal>
        </Container>
      </section>
    </>
  );
}
