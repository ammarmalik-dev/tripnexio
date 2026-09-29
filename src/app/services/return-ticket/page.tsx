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
import { ServiceFaqSection } from "@/components/services/ServiceFaqSection";
import {
  DocumentsRequiredSection,
  type ReturnTicketLandingDocument,
} from "@/components/services/return-ticket/landing/DocumentsRequiredSection";
import { VerificationTimingSection } from "@/components/services/return-ticket/landing/VerificationTimingSection";
import {
  CancellationRefundSection,
  type ReturnTicketLandingDestination,
} from "@/components/services/return-ticket/landing/CancellationRefundSection";
import { DisclaimerAfterTravelSection } from "@/components/services/return-ticket/landing/DisclaimerAfterTravelSection";
import { db } from "@/lib/db";

// Admin-managed documents/destinations are read at request time, cached 5 min.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Return Verified Ticket",
  description:
    "A verifiable return ticket reservation for international travel. Share your destination and travel date — we take care of the rest.",
};

const whatYoullNeed = ["Full name", "Mobile number", "Email address", "Destination country", "Number of passengers", "Travel date"];

// Locked content — doc §8 "How It Works — final customer copy" (5 steps).
// "airline/vendor" in the source doc kept as "airline/partner" — the
// client's own site-wide Sep 24 wording instruction (Vendor -> Partner)
// takes precedence over this doc's literal wording.
const visaProcessSteps = [
  { step: "01", headline: "Share your travel details", supportingCopy: "Tell us your destination, number of passengers and travel date." },
  { step: "02", headline: "We work out the return date", supportingCopy: "We arrange an approximate return date based on available ticket options and your travel schedule." },
  { step: "03", headline: "Complete payment", supportingCopy: "Review the summary and applicable terms, then complete payment." },
  { step: "04", headline: "We arrange your return ticket reservation", supportingCopy: "Our team processes the return ticket through the configured airline/partner process based on current availability." },
  { step: "05", headline: "Receive your return ticket", supportingCopy: "Once issued, your return ticket is delivered to you." },
];

/**
 * Admin's RETURN_TICKET document checklist — same filter as the checkout
 * (src/lib/checkout/required-documents.ts): active rows with no nationality
 * (this service never collects one). Destination-specific rows are left out
 * since no destination is chosen on this page. Deduped by name.
 */
async function loadDocuments(): Promise<ReturnTicketLandingDocument[] | null> {
  try {
    const rows = await db.documentRequirement.findMany({
      where: { serviceType: "RETURN_TICKET", active: true, nationality: null, nationalityId: null, countryId: null },
      orderBy: [{ required: "desc" }, { documentName: "asc" }],
      select: { documentName: true, required: true },
    });
    const seen = new Set<string>();
    const documents: ReturnTicketLandingDocument[] = [];
    for (const row of rows) {
      const key = row.documentName.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      documents.push({ name: row.documentName, required: row.required });
    }
    return documents;
  } catch (error) {
    console.error("[return-ticket-landing] couldn't load document requirements", error);
    return null;
  }
}

/** Active destinations with their Admin-set rate and cancellation fee (same filter as /api/return-ticket/destinations). */
async function loadDestinations(): Promise<ReturnTicketLandingDestination[] | null> {
  try {
    const rows = await db.returnTicketDestination.findMany({
      where: { active: true, country: { active: true } },
      orderBy: [{ displayOrder: "asc" }, { country: { name: "asc" } }],
      select: { ratePerApplicant: true, cancellationFee: true, country: { select: { name: true } } },
    });
    return rows.map((row) => ({
      countryName: row.country.name,
      ratePerApplicant: Number(row.ratePerApplicant),
      cancellationFee: row.cancellationFee === null ? null : Number(row.cancellationFee),
    }));
  } catch (error) {
    console.error("[return-ticket-landing] couldn't load destinations", error);
    return null;
  }
}

export default async function ReturnTicketLandingPage() {
  const [documents, destinations] = await Promise.all([loadDocuments(), loadDestinations()]);
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
        <Container className="flex flex-col items-center gap-4 text-center">
          <MotionReveal>
            <SectionHeading
              align="center"
              eyebrow="What is a Return Verified Ticket?"
              title="Your return ticket, arranged for your trip"
              className="mx-auto"
            />
          </MotionReveal>
          <MotionReveal delay={0.06}>
            <p className="max-w-2xl text-sm text-ink-secondary sm:text-base">
              A Return Verified Ticket is a return ticket reservation arranged for international travel and intended to
              provide proof of return travel where applicable. TripNexio arranges the reservation according to the
              travel details provided and configured airline/partner availability.
            </p>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <MotionReveal>
            <div className="flex flex-col gap-4">
              <SectionHeading eyebrow="How the return date works" title="Tell us your expected return date" />
              <p className="text-sm text-ink-secondary sm:text-base">
                You select your destination country, travel date and expected return date. TripNexio looks for a
                suitable return ticket close to your expected date and issues it according to live ticket
                availability.
              </p>
              <ul className="flex flex-col gap-2.5">
                <li className="flex items-start gap-2.5 text-sm text-ink-secondary">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  No visa-validity date is requested. You provide an expected return date so we can search for a
                  suitable ticket close to that date.
                </li>
                <li className="flex items-start gap-2.5 text-sm text-ink-secondary">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  The exact issue date is not selected by you. TripNexio issues the reservation according to available
                  ticket inventory and the applicable travel schedule.
                </li>
              </ul>
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

      <DocumentsRequiredSection documents={documents} />

      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-12">
          <MotionReveal>
            <SectionHeading align="center" eyebrow="Simple steps" title="How it works" className="mx-auto" />
          </MotionReveal>
          <VisaProcessSteps steps={visaProcessSteps} />
        </Container>
      </section>

      <VerificationTimingSection />

      <CancellationRefundSection destinations={destinations} />

      <DisclaimerAfterTravelSection />

      <ServiceFaqSection serviceType="RETURN_TICKET" />

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
