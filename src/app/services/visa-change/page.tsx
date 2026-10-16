import type { Metadata } from "next";
import { ArrowLeftRight, Clock, ClipboardList, SearchCheck, CreditCard, BadgeCheck } from "lucide-react";
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
import { getSitePageContent } from "@/lib/site-content/get-page-content";

// Admin-managed pricing + FAQs are read at render; refresh every 5 minutes.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Visa Change",
  description:
    "Change your UAE visa status — Airport-to-Airport or Border Exit, confirmed by our team. Submit your details online and we handle the rest.",
};

// Client correction 2026-10-05 — exactly 4 steps.
const visaProcessSteps = [
  { step: "01", icon: ClipboardList, headline: "Start Your Application", supportingCopy: "Choose A2A or Border Exit and enter your traveller details." },
  { step: "02", icon: SearchCheck, headline: "We Check & Confirm Availability", supportingCopy: "Our team checks availability and shares the available option." },
  { step: "03", icon: CreditCard, headline: "Choose Your Option & Pay", supportingCopy: "Select your confirmed date, time and package, then review and complete payment." },
  { step: "04", icon: BadgeCheck, headline: "We Complete Your Visa Change", supportingCopy: "Follow the exit instructions. After exit completion, the new visa process starts and the approved visa is delivered." },
];

export default async function VisaChangeLandingPage() {
  // Client doc 2026-10-15 (J3) — photo and main wording from Admin → Website Pages (blank = this copy).
  const content = await getSitePageContent("visa-change");
  return (
    <>
      <section className="relative overflow-hidden">
        <ServiceHeroBackdrop service="VISA_CHANGE" imageSrc={content.heroImageUrl} />
        <Container className="relative flex flex-col items-center gap-6 pb-14 pt-8 text-center sm:pb-20 sm:pt-10">
          <MotionReveal>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <ArrowLeftRight className="h-6 w-6" aria-hidden="true" />
            </span>
          </MotionReveal>
          <MotionReveal delay={0.04}>
            <span className="text-sm font-medium tracking-wide text-ink-accent uppercase">{content.text("heroEyebrow")}</span>
          </MotionReveal>
          <MotionReveal delay={0.06}>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink-heading sm:text-5xl">{content.text("heroTitle")}</h1>
          </MotionReveal>
          <MotionReveal delay={0.12}>
            <p className="max-w-xl text-base text-ink-secondary sm:text-lg">{content.text("heroSubtitle")}</p>
          </MotionReveal>
          <MotionReveal delay={0.18}>
            <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
              <ButtonLink href="/services/visa-change/request" variant="primary" size="lg">{content.text("applyLabel")}</ButtonLink>
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

      <section className="py-10 sm:py-14">
        <Container className="flex flex-col gap-8">
          <MotionReveal>
            <SectionHeading align="center" eyebrow="Simple steps" title="How It Works" className="mx-auto" />
          </MotionReveal>
          <VisaProcessSteps steps={content.steps(visaProcessSteps)} />
        </Container>
      </section>

      <VisaChangeConfirmedOptions />
      <VisaChangeAfterBooking />

      <ServiceFaqSection serviceType="VISA_CHANGE" />

      <section className="pb-14 sm:pb-20">
        <Container>
          <MotionReveal>
            <div className="surface-dark-block flex flex-col items-center gap-6 rounded-xl p-8 text-center sm:p-12">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-ink-on-dark-primary">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-ink-on-dark-primary sm:text-3xl">{content.text("ctaHeading")}</h2>
              <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
                <ButtonLink href="/services/visa-change/request" variant="primary" size="lg">{content.text("applyLabel")}</ButtonLink>
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
