import type { Metadata } from "next";
import {
  PlaneTakeoff,
  ShieldCheck,
  Clock,
  FileCheck2,
  CheckCircle2,
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
import { GradientMesh } from "@/components/motion/GradientMesh";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { utilityLinks } from "@/lib/nav-config";
import { VisaProcessSteps } from "@/components/services/VisaProcessSteps";
import { ServiceFaqSection } from "@/components/services/ServiceFaqSection";
import { OtbPricingSection } from "@/components/services/otb/landing/OtbPricingSection";
import { OtbCancellationRefundSection } from "@/components/services/otb/landing/OtbCancellationRefundSection";

// Pricing (Admin Airline master) and FAQs (Admin Faq rows) are DB-backed.
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
];

const documentsNeeded = [
  "Passport front page",
  "Passport last page",
  "Valid destination visa",
  "Flight ticket (where not already available)",
  "Return ticket (where applicable)",
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

// Locked content — doc §10 "How It Works".
const otbProcessSteps = [
  { step: "01", headline: "Share your flight details", supportingCopy: "Enter your airline, travel date and contact details." },
  { step: "02", headline: "Submit your documents", supportingCopy: "Provide the required passport, destination visa, flight and return-ticket documents." },
  { step: "03", headline: "We process your OTB", supportingCopy: "TripNexio coordinates the request through the relevant airline/process channel." },
  { step: "04", headline: "Get your OTB confirmation", supportingCopy: "Once approved, your OTB PNR/reference is shared with you." },
];

// Locked content — doc §14 "Why TripNexio?".
const whyTripNexio = [
  { title: "India-Based Processing", description: "Submit and coordinate your OTB application from India before travel." },
  { title: "Airline Network Support", description: "We coordinate with the relevant airline/process channel." },
  { title: "Airline-Specific Timelines", description: "Processing time and availability can differ by airline." },
  { title: "Document Assistance", description: "Know what is required and receive requests when something is missing." },
  { title: "Status Updates", description: "Receive application and approval updates through configured TripNexio channels." },
  { title: "Return Ticket Support", description: "Need a return ticket? TripNexio can provide the separate Return Verified Ticket service where applicable." },
];

export default function OtbLandingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <GradientMesh />
        <Container className="relative flex flex-col items-center gap-6 py-20 text-center sm:py-28">
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
            <div className="flex flex-wrap items-center justify-center gap-3">
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

      <section className="py-16 sm:py-20">
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
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
      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-10">
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

      <section className="py-16 sm:py-20">
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
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

      {/* Doc §8 — What You'll Need. */}
      <section className="py-16 sm:py-20">
        <Container>
          <MotionReveal>
            <GlassCard tier={2} className="flex flex-col gap-4 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <FileCheck2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-base font-semibold text-ink-heading">What you&rsquo;ll need</h2>
              </div>
              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {whatYoullNeed.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-ink-secondary">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink-tertiary">No separate nationality field is required.</p>
            </GlassCard>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <MotionReveal>
            <GlassCard tier={1} className="flex flex-col gap-4 p-6 sm:p-8">
              <h2 className="text-base font-semibold text-ink-heading">OTB is an update, not a separate document</h2>
              <p className="text-sm text-ink-secondary">
                OTB is a clearance added to the applicable flight booking or ticket record &mdash; it isn&rsquo;t a
                separate visa, ticket or immigration document. The supporting details TripNexio needs are:
              </p>
              <ul className="flex flex-wrap gap-2.5">
                {documentsNeeded.map((item) => (
                  <li
                    key={item}
                    className="rounded-full border border-hairline bg-surface-1 px-3.5 py-1.5 text-xs font-medium text-ink-secondary"
                  >
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-ink-secondary">
                After the OTB is updated, you can ask the airline&rsquo;s customer support to confirm the status,
                and airline check-in staff can also check the airline&rsquo;s system at the time of travel.
              </p>
            </GlassCard>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-12">
          <MotionReveal>
            <SectionHeading align="center" eyebrow="Simple steps" title="Get your OTB in simple steps" className="mx-auto" />
          </MotionReveal>
          <VisaProcessSteps steps={otbProcessSteps} />
        </Container>
      </section>

      <section className="py-16 sm:py-20">
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

      <section className="py-16 sm:py-20">
        <Container>
          <MotionReveal>
            <GlassCard tier={2} className="flex flex-col gap-3 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-base font-semibold text-ink-heading">Get your OTB updated before travel</h2>
              </div>
              <p className="text-sm text-ink-secondary">
                TripNexio processes OTB updates before travel when the passenger is departing from India.
              </p>
              <p className="text-sm text-ink-secondary">
                OTB should be updated before the customer reaches the airport. Once updated, the airline&rsquo;s
                customer support can be contacted to confirm the status, and airline check-in staff can check the
                airline system at the time of travel.
              </p>
              <p className="text-sm text-ink-secondary">
                If the passenger is travelling from another country, TripNexio cannot update the OTB through this
                service, even if the airline is an India- or Gulf-based airline.
              </p>
              <p className="text-sm font-medium text-ink-primary">
                TripNexio does not guarantee boarding or immigration clearance. Final boarding and immigration
                decisions remain with the airline and relevant authorities.
              </p>
            </GlassCard>
          </MotionReveal>
        </Container>
      </section>

      {/* Doc §13 — prices from the Admin Airline master, never hard-coded. */}
      <OtbPricingSection />

      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-10">
          <MotionReveal>
            <SectionHeading align="center" eyebrow="Why TripNexio?" title="Simple, guided OTB processing" className="mx-auto" />
          </MotionReveal>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {whyTripNexio.map((item, index) => (
              <MotionReveal key={item.title} delay={index * 0.05}>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-semibold text-ink-heading">{item.title}</h3>
                  <p className="text-xs text-ink-tertiary">{item.description}</p>
                </div>
              </MotionReveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Doc §15 Return Ticket + §16 OTB Approval / status confirmation. */}
      <section className="py-16 sm:py-20">
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
                Your OTB PNR/reference is shared through the available TripNexio channels and updated in your
                customer portal.
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

      <OtbCancellationRefundSection />

      <ServiceFaqSection serviceType="OTB" />

      <section className="pb-20 sm:pb-28">
        <Container>
          <MotionReveal>
            <div className="surface-dark-block flex flex-col items-center gap-6 rounded-xl p-8 text-center sm:p-12">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-ink-on-dark-primary">
                <PlaneTakeoff className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-ink-on-dark-primary sm:text-3xl">
                Ready to request your OTB?
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-3">
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
