import type { Metadata } from "next";
import { FileText, Clock, MapPin, Briefcase, GraduationCap, Users, Baby } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradientMesh } from "@/components/motion/GradientMesh";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { utilityLinks } from "@/lib/nav-config";
import { NewVisaProductSelector } from "@/components/services/new-visa/NewVisaProductSelector";
import { VisaProcessSteps } from "@/components/services/VisaProcessSteps";
import { ServiceFaqSection } from "@/components/services/ServiceFaqSection";
import { NewVisaRequirementsSection } from "@/components/services/new-visa/landing/NewVisaRequirementsSection";
import { NewVisaProcessingTimeSection } from "@/components/services/new-visa/landing/NewVisaProcessingTimeSection";
import {
  NewVisaValiditySection,
  NewVisaBeforeYouApplySection,
} from "@/components/services/new-visa/landing/NewVisaValidityAndNotesSections";

// FAQ rows and Admin-managed timelines refresh without a redeploy.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "New Visa",
  description:
    "UAE visa, made simple. Apply online, choose your visa option, and let TripNexio guide you from application to completion.",
};

// Locked content — doc §9 "The Visa Process — reference-style visual".
const visaProcessSteps = [
  { step: "01", headline: "Apply online", supportingCopy: "Choose your UAE visa option and submit your traveller details." },
  { step: "02", headline: "Upload documents", supportingCopy: "Complete payment and upload the required documents." },
  { step: "03", headline: "We process your application", supportingCopy: "We coordinate the next steps and keep you updated." },
  { step: "04", headline: "Visa delivered", supportingCopy: "Receive your issued visa digitally once approved and issued." },
];

// Doc §5 "UAE Visa Applications From Across India" — "minimal applicant icons," not a long occupation list.
const applicantProfileIcons = [MapPin, Briefcase, GraduationCap, Users];

export default function NewVisaLandingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <GradientMesh />
        <Container className="relative flex flex-col items-center gap-6 py-20 text-center sm:py-28">
          <MotionReveal>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <FileText className="h-6 w-6" aria-hidden="true" />
            </span>
          </MotionReveal>
          <MotionReveal delay={0.04}>
            <span className="text-sm font-medium tracking-wide text-ink-accent uppercase">UAE Visa</span>
          </MotionReveal>
          <MotionReveal delay={0.06}>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink-heading sm:text-5xl">
              UAE Visa Made Simple
            </h1>
          </MotionReveal>
          <MotionReveal delay={0.12}>
            <p className="max-w-xl text-base text-ink-secondary sm:text-lg">
              UAE visa, made simple. Apply online, choose your visa option,
              and let TripNexio guide you from application to completion.
            </p>
          </MotionReveal>
          <MotionReveal delay={0.18}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/services/new-visa/request" variant="primary" size="lg">
                Apply for UAE Visa
              </ButtonLink>
              <ButtonLink href={utilityLinks.trackStatus.href} variant="glass" size="lg">
                Track Application
              </ButtonLink>
            </div>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <MotionReveal>
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {/* Locked copy — UAE Visa Page Content FINAL §2. */}
              <SectionHeading eyebrow="What is a New Visa Request?" title="Your UAE visa application, guided end to end" />
              <p className="text-sm text-ink-secondary sm:text-base">
                Applying for a UAE visa involves choosing the right visa
                option, sharing accurate traveller details and completing the
                required documents. TripNexio keeps the process simple,
                coordinates the next steps with the relevant processing partner
                or authority, and helps you track your application along the
                way.
              </p>
            </div>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-6">
          <MotionReveal>
            <SectionHeading align="center" eyebrow="UAE visa options" title="Choose your visa and see the price instantly" className="mx-auto" />
          </MotionReveal>
          <MotionReveal delay={0.08}>
            <div className="mx-auto w-full max-w-2xl">
              <NewVisaProductSelector />
            </div>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container className="flex flex-col items-center gap-5 text-center">
          <MotionReveal>
            <SectionHeading align="center" title="UAE Visa Applications From Across India" className="mx-auto" />
          </MotionReveal>
          <MotionReveal delay={0.06}>
            <p className="max-w-xl text-sm text-ink-secondary sm:text-base">
              From every Indian state to different applicant profiles, TripNexio provides a simple way to apply for your UAE visa online.
            </p>
          </MotionReveal>
          <MotionReveal delay={0.12}>
            <div className="flex items-center gap-4 pt-2">
              {applicantProfileIcons.map((Icon, index) => (
                <span key={index} className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
              ))}
            </div>
          </MotionReveal>
        </Container>
      </section>

      <NewVisaRequirementsSection />

      <section className="py-16 sm:py-20">
        <Container>
          <MotionReveal>
            <GlassCard tier={2} className="mx-auto flex max-w-3xl flex-col items-start gap-4 p-6 sm:flex-row sm:p-8">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <Baby className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-2">
                {/* Locked copy — UAE Visa Page Content FINAL §7. */}
                <h2 className="text-xl font-semibold text-ink-heading sm:text-2xl">Travelling with children</h2>
                <p className="text-sm text-ink-secondary sm:text-base">
                  Applicants under 18 years must apply with at least one parent in the same booking. The child must be
                  linked to that parent. Adult and Child pricing can be configured separately.
                </p>
              </div>
            </GlassCard>
          </MotionReveal>
        </Container>
      </section>

      <NewVisaProcessingTimeSection />

      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-12">
          <MotionReveal>
            <SectionHeading align="center" eyebrow="The visa process" title="How it works" className="mx-auto" />
          </MotionReveal>
          <VisaProcessSteps steps={visaProcessSteps} sampleStatusText="Your visa application is being processed." />
        </Container>
      </section>

      <NewVisaValiditySection />

      <NewVisaBeforeYouApplySection />

      <ServiceFaqSection serviceType="NEW_VISA" />

      <section className="pb-20 sm:pb-28">
        <Container>
          <MotionReveal>
            <div className="surface-dark-block flex flex-col items-center gap-6 rounded-xl p-8 text-center sm:p-12">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-ink-on-dark-primary">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </span>
              {/* Locked copy — UAE Visa Page Content FINAL §13. */}
              <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-ink-on-dark-primary sm:text-3xl">
                Ready to apply for your UAE visa?
              </h2>
              <p className="max-w-xl text-sm text-ink-on-dark-secondary sm:text-base">
                Choose your visa option, enter your traveller details and complete your application online.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <ButtonLink href="/services/new-visa/request" variant="primary" size="lg">
                  Apply for UAE Visa
                </ButtonLink>
                <ButtonLink
                  href={utilityLinks.trackStatus.href}
                  variant="ghost"
                  size="lg"
                  className="border-white/40 text-white hover:border-white/70 hover:bg-white/5"
                >
                  Track Application
                </ButtonLink>
              </div>
            </div>
          </MotionReveal>
        </Container>
      </section>
    </>
  );
}
