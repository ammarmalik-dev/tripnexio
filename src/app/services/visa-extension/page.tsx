import type { Metadata } from "next";
import { CalendarClock, Clock, ClipboardList, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradientMesh } from "@/components/motion/GradientMesh";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { utilityLinks } from "@/lib/nav-config";
import { VisaProcessSteps } from "@/components/services/VisaProcessSteps";

export const metadata: Metadata = {
  title: "Visa Extension",
  description:
    "Extend an existing UAE visa originally issued through TripNexio — submit your details online and our team verifies and processes your extension.",
};

const whatYoullNeed = [
  "Full name",
  "Mobile number",
  "Email address",
  "Passport number",
  "Date of birth",
  "Whether you're currently inside the UAE",
  "UAE entry date",
];

// Locked content — doc §5 "How It Works — reference-style 4-step journey".
const visaProcessSteps = [
  { step: "01", headline: "Share your visa details", supportingCopy: "Enter your name, mobile number, email address, passport number and visa expiry date." },
  { step: "02", headline: "We check your eligibility", supportingCopy: "We review your existing TripNexio visa and extension eligibility." },
  { step: "03", headline: "Review your extension", supportingCopy: "See the verified visa details, extension fee, applicable fine/overstay amount and payment deadline." },
  { step: "04", headline: "Get your extended visa", supportingCopy: "Complete payment and receive your extended visa once processing is completed." },
];

export default function VisaExtensionLandingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <GradientMesh />
        <Container className="relative flex flex-col items-center gap-6 py-20 text-center sm:py-28">
          <MotionReveal>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <CalendarClock className="h-6 w-6" aria-hidden="true" />
            </span>
          </MotionReveal>
          <MotionReveal delay={0.04}>
            <span className="text-sm font-medium tracking-wide text-ink-accent uppercase">UAE Visa Extension</span>
          </MotionReveal>
          <MotionReveal delay={0.06}>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink-heading sm:text-5xl">
              Extend Your UAE Visa
            </h1>
          </MotionReveal>
          <MotionReveal delay={0.12}>
            <p className="max-w-xl text-base text-ink-secondary sm:text-lg">
              Extend an existing UAE visa originally issued through TripNexio. Submit your details online — our
              team verifies your visa and handles the extension process from there.
            </p>
          </MotionReveal>
          <MotionReveal delay={0.15}>
            <p className="text-sm font-medium text-ink-tertiary">30-Day Extension • Online Request • Guided Process</p>
          </MotionReveal>
          <MotionReveal delay={0.18}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/services/visa-extension/request" variant="primary" size="lg">
                Apply for Visa Extension
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
              <SectionHeading eyebrow="Who is this for?" title="Only for TripNexio-issued visas" />
              <p className="text-sm text-ink-secondary sm:text-base">
                We currently offer Visa Extension only for visas originally issued through TripNexio. If we can&apos;t
                find a matching TripNexio visa for your details, we&apos;ll point you to the right service instead —
                Visa Change if you&apos;re inside the UAE, or New Visa if you&apos;re outside the UAE.
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
                Ready to extend your visa?
              </h2>
              <ButtonLink href="/services/visa-extension/request" variant="primary" size="lg">
                Start Extension Request
              </ButtonLink>
            </div>
          </MotionReveal>
        </Container>
      </section>
    </>
  );
}
