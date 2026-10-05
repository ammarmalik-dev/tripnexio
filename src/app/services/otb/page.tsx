import type { Metadata } from "next";
import {
  PlaneTakeoff,
  Clock,
  FileCheck2,
  BadgeCheck,
  Stamp,
  Network,
  Ticket,
  TriangleAlert,
} from "lucide-react";
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

// FAQs (Admin Faq rows) are DB-backed. No prices on this page (client correction 2026-10-05).
export const revalidate = 300;

export const metadata: Metadata = {
  title: "OTB — OK to Board",
  description:
    "OK to Board (OTB) airline clearance for Indian ECR passport holders travelling from India — request online and TripNexio coordinates the update with the relevant airline before you travel.",
};

// Locked content — TripNexio_OTB_Final_Page_Content_Design_FAQ_v3.docx §8/§19.
// Passport Number and Destination Country are both required customer-form fields;
// no separate nationality field. "Valid Destination Visa" (not "UAE Visa") — OTB isn't UAE-only.
const whatYoullNeed = [
  "Full name",
  "Passport number",
  "Mobile number",
  "Email address",
  "Destination country",
  "Airline",
  "Travel date",
].map((label) => ({ label }));

// Client correction 2026-10-05 — the OTB document list.
const documentsNeeded = [
  { name: "Passport Front Page", required: true },
  { name: "Passport Last Page", required: true },
  { name: "Valid Visa Copy", required: true },
  { name: "Onward Ticket", required: true },
  { name: "Return Ticket", required: true },
];

// Locked content — doc §5 "ECR & ECNR — OTB Service".
const ecrEcnrSupport = [
  {
    title: "ECR Passport Holders",
    description:
      "For a smoother travel experience, TripNexio accepts OTB applications from Indian ECR passport holders travelling on applicable Gulf-bound flights and processes the OTB before travel.",
  },
  {
    title: "ECNR / Non-ECR Passport Holders",
    description:
      "OTB may not be required for every ECNR/Non-ECR traveller. However, customers who want OTB arranged can request the service where the applicable airline/process channel supports it.",
  },
];

// Client correction 2026-10-05 — exactly 4 steps.
const otbProcessSteps = [
  { step: "01", icon: PlaneTakeoff, headline: "Share Your Flight Details", supportingCopy: "Enter your airline, travel date and contact details." },
  { step: "02", icon: FileCheck2, headline: "Submit Your Documents & Pay", supportingCopy: "Provide the required documents, review the applicable service details and complete payment." },
  { step: "03", icon: Network, headline: "We Process Your OTB", supportingCopy: "TripNexio coordinates the request through the relevant airline/process channel." },
  { step: "04", icon: BadgeCheck, headline: "Get Your OTB Confirmation", supportingCopy: "Once the airline confirms the OTB, we share the confirmation/reference with you and update your status via WhatsApp and email." },
];

export default function OtbLandingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <ServiceHeroBackdrop service="OTB" />
        <Container className="relative flex flex-col items-center gap-6 py-14 text-center sm:py-20">
          <MotionReveal>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <PlaneTakeoff className="h-6 w-6" aria-hidden="true" />
            </span>
          </MotionReveal>
          <MotionReveal delay={0.04}>
            <span className="text-sm font-medium tracking-wide text-ink-accent uppercase">OK to Board</span>
          </MotionReveal>
          <MotionReveal delay={0.05}>
            {/* P18 — OTB Page Content v3 hero badge. */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-on-light">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Official OTB Partner
            </span>
          </MotionReveal>
          <MotionReveal delay={0.06}>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink-heading sm:text-5xl">
              OK to Board, Made Simple
            </h1>
          </MotionReveal>
          <MotionReveal delay={0.12}>
            <p className="max-w-xl text-base text-ink-secondary sm:text-lg">
              Travelling from India with an ECR passport? Get your OTB arranged before your flight and travel with
              greater peace of mind. TripNexio coordinates the OTB process with the relevant airline and keeps you
              updated until completion.
            </p>
          </MotionReveal>
          <MotionReveal delay={0.15}>
            <p className="text-sm font-medium text-ink-tertiary">India-Based Processing · Airline-Specific Timelines · Status Updates</p>
          </MotionReveal>
          <MotionReveal delay={0.18}>
            <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
              <ButtonLink href="/services/otb/request" variant="primary" size="lg">
                Request OTB
              </ButtonLink>
              <ButtonLink href={utilityLinks.trackStatus.href} variant="glass" size="lg">
                Track Status
              </ButtonLink>
            </div>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-10 sm:py-14">
        <Container className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          <MotionReveal>
            <div className="flex flex-col gap-4">
              <SectionHeading eyebrow="What is OK to Board?" title="Your airline clearance, handled for you" />
              <p className="text-sm text-ink-secondary sm:text-base">
                OK to Board (OTB) is an airline clearance process that may be required for certain Gulf-bound
                journeys. TripNexio helps eligible Indian passport holders arrange OTB before travel through the
                applicable airline/process channel. OTB is an airline process and is separate from Indian
                emigration clearance.
              </p>
            </div>
          </MotionReveal>

          <MotionReveal delay={0.08}>
            <GlassCard tier={2} className="flex flex-col gap-4 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <BadgeCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="flex flex-col">
                  <span className="text-xs font-medium tracking-wide text-ink-accent uppercase">ECR / Non-ECR</span>
                  <h3 className="text-base font-semibold text-ink-heading">Check your passport endorsement</h3>
                </div>
              </div>
              <p className="text-sm text-ink-secondary">
                An ECR passport has the words &ldquo;Emigration Check Required&rdquo; printed/endorsed on the
                passport, usually on the last page/endorsement area. If that isn&rsquo;t printed, the passport is
                treated as Non-ECR / ECNR for this service.
              </p>
              <p className="text-sm text-ink-secondary">
                Indian ECR passport holders travelling on an applicable eVisa are advised to arrange OTB before
                travel. ECNR / Non-ECR travellers may not require OTB, but can request it where they want the
                airline clearance arranged and the applicable process supports it.
              </p>
            </GlassCard>
          </MotionReveal>
        </Container>
      </section>

      {/* Doc §5 — ECR & ECNR OTB service. */}
      <section className="py-10 sm:py-14">
        <Container className="flex flex-col gap-8">
          <MotionReveal>
            <SectionHeading
              align="center"
              eyebrow="ECR & ECNR"
              title="OTB support for ECR and ECNR travellers"
              className="mx-auto"
            />
          </MotionReveal>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {ecrEcnrSupport.map((item, index) => (
              <MotionReveal key={item.title} delay={index * 0.06} className="h-full">
                <GlassCard tier={2} className="flex h-full flex-col gap-3 p-6 sm:p-8">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                    <Stamp className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold text-ink-heading">{item.title}</h3>
                  <p className="text-sm text-ink-secondary">{item.description}</p>
                </GlassCard>
              </MotionReveal>
            ))}
          </div>
          <MotionReveal>
            <p className="mx-auto max-w-2xl text-center text-xs text-ink-tertiary">
              OTB is an airline clearance service; it is not a substitute for Indian emigration clearance.
            </p>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-10 sm:py-14">
        <Container className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          <MotionReveal className="h-full">
            <GlassCard tier={2} className="flex h-full flex-col gap-3 p-6 sm:p-8">
              <span className="text-xs font-medium tracking-wide text-ink-accent uppercase">India departure</span>
              <h2 className="text-base font-semibold text-ink-heading">OTB for Indian travellers departing from India</h2>
              <p className="text-sm text-ink-secondary">
                TripNexio processes OTB for Indian travellers when the journey is departing from India. The airline
                may be India-based or Gulf-based &mdash; what matters is that the passenger&rsquo;s flight is
                departing from India. If an Indian traveller is departing from another country, TripNexio cannot
                update the OTB through this service, even if the airline is India- or Gulf-based.
              </p>
              <p className="text-sm text-ink-secondary">
                OTB should be arranged before the passenger travels to the airport. TripNexio coordinates the
                applicable airline process and provides status updates during processing.
              </p>
            </GlassCard>
          </MotionReveal>

          <MotionReveal delay={0.08} className="h-full">
            {/* Doc §7 — Airline Network. */}
            <GlassCard tier={2} className="flex h-full flex-col gap-3 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <Network className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="flex flex-col">
                  <span className="text-xs font-medium tracking-wide text-ink-accent uppercase">Airline network</span>
                  <h2 className="text-base font-semibold text-ink-heading">Supported airlines, India departure only</h2>
                </div>
              </div>
              <p className="text-sm text-ink-secondary">
                TripNexio can coordinate OTB updates with supported India- and Gulf-based airlines where the
                applicable airline process is available.
              </p>
              <p className="text-sm text-ink-secondary">
                The key limitation is the departure point: TripNexio&rsquo;s OTB service can update OTB for
                passengers travelling from India. We cannot update OTB when the passenger is departing from another
                country.
              </p>
              <p className="text-sm text-ink-secondary">
                Airline processing timelines can differ. Normal and Urgent options are shown according to the
                selected airline, travel date and operational availability.
              </p>
            </GlassCard>
          </MotionReveal>
        </Container>
      </section>

      <ServiceRequirementsSection
        whatYouNeed={whatYoullNeed}
        documents={documentsNeeded}
        notes={[
          "OTB is not a separate document. It is a confirmation/update made by the airline on your booking. Once the airline confirms it, we notify you by WhatsApp and email and update your status on Track Status.",
          "Additional documents may be requested if the airline asks for them during processing.",
        ]}
      />

      <section className="py-10 sm:py-14">
        <Container className="flex flex-col gap-8">
          <MotionReveal>
            <SectionHeading align="center" eyebrow="Simple steps" title="How It Works" className="mx-auto" />
          </MotionReveal>
          <VisaProcessSteps steps={otbProcessSteps} />
        </Container>
      </section>

      <section className="py-10 sm:py-14">
        <Container>
          <MotionReveal>
            <div className="surface-dark-block flex flex-col gap-3 rounded-xl p-6 text-center sm:p-10">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-ink-on-dark-primary">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold text-ink-on-dark-primary">Processing time depends on the airline</h2>
              <p className="mx-auto max-w-xl text-sm text-ink-on-dark-secondary">
                Normal is standard OTB processing when available; Urgent is faster processing for urgent travel when
                available. You&rsquo;ll only see the options currently available for your selected airline and
                travel date, and the exact price for each before you pay.
              </p>
            </div>
          </MotionReveal>
        </Container>
      </section>

      {/* Doc §15 Return Ticket + §16 OTB Approval / status confirmation. */}
      <section className="py-10 sm:py-14">
        <Container className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <MotionReveal className="h-full">
            <GlassCard tier={2} className="flex h-full flex-col gap-4 p-6 sm:p-8">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <Ticket className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold text-ink-heading">Need a Return Ticket?</h2>
              <p className="text-sm text-ink-secondary">
                If your return ticket is missing, TripNexio can arrange a separate Return Verified Ticket and link it
                with the OTB journey where applicable.
              </p>
              <div className="mt-auto pt-2">
                <ButtonLink href="/services/return-ticket" variant="primary" size="md">
                  Get Return Ticket
                </ButtonLink>
              </div>
            </GlassCard>
          </MotionReveal>

          <MotionReveal delay={0.08} className="h-full">
            <GlassCard tier={2} className="flex h-full flex-col gap-4 p-6 sm:p-8">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <BadgeCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium tracking-wide text-ink-accent uppercase">Once approved</span>
                <h2 className="text-lg font-semibold text-ink-heading">OTB Approval</h2>
              </div>
              <p className="text-sm text-ink-secondary">
                Once the airline confirms your OTB, we share the confirmation/reference with you by WhatsApp and email
                and update the status on Track Status.
              </p>
              <div role="note" className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                <p className="text-xs text-ink-primary sm:text-sm">
                  <span className="font-semibold">Important: </span>
                  TripNexio provides OTB processing as a service provider. OTB approval does not guarantee airline
                  boarding, immigration clearance, visa approval or entry into the destination country. Final boarding
                  and immigration decisions remain with the relevant airline and authorities.
                </p>
              </div>
            </GlassCard>
          </MotionReveal>
        </Container>
      </section>

      <ServiceFaqSection serviceType="OTB" />

      <section className="pb-14 sm:pb-20">
        <Container>
          <MotionReveal>
            <div className="surface-dark-block flex flex-col items-center gap-6 rounded-xl p-8 text-center sm:p-12">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-ink-on-dark-primary">
                <PlaneTakeoff className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-ink-on-dark-primary sm:text-3xl">
                Ready to request your OTB?
              </h2>
              <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
                <ButtonLink href="/services/otb/request" variant="primary" size="lg">
                  Request OTB
                </ButtonLink>
                <ButtonLink href="/services/return-ticket" variant="ghost" size="lg" className="border-white/40 text-white hover:border-white/70 hover:bg-white/5">
                  Get Return Ticket
                </ButtonLink>
              </div>
            </div>
          </MotionReveal>
        </Container>
      </section>
    </>
  );
}
