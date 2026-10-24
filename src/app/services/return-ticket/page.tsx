import type { Metadata } from "next";
import { TicketCheck, Clock, CheckCircle2, MapPinned, CreditCard, Settings2, Send } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ServiceHeroBackdrop } from "@/components/services/ServiceHeroBackdrop";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { utilityLinks } from "@/lib/nav-config";
import { VisaProcessSteps } from "@/components/services/VisaProcessSteps";
import { ServiceFaqSection } from "@/components/services/ServiceFaqSection";
import {
  returnTicketDocumentsForDisplay,
  type ReturnTicketLandingDocument,
} from "@/components/services/return-ticket/landing/DocumentsRequiredSection";
import { ServiceRequirementsSection } from "@/components/services/ServiceRequirementsSection";
import { VerificationTimingSection } from "@/components/services/return-ticket/landing/VerificationTimingSection";
import {
  CancellationRefundSection,
  type ReturnTicketLandingDestination,
} from "@/components/services/return-ticket/landing/CancellationRefundSection";
import { DisclaimerAfterTravelSection } from "@/components/services/return-ticket/landing/DisclaimerAfterTravelSection";
import { db } from "@/lib/db";
import { getSitePageContent } from "@/lib/site-content/get-page-content";

// Admin-managed documents/destinations are read at request time, cached 5 min.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Return Verified Ticket",
  description:
    "A verifiable return ticket reservation for international travel. Share your destination and travel date — we take care of the rest.",
};

// Client correction 2026-10-05 — exactly 4 short steps. "airline/partner"
// follows the client's site-wide Vendor -> Partner wording.
const visaProcessSteps = [
  { step: "01", icon: MapPinned, headline: "Share Your Travel Details", supportingCopy: "Enter your destination, passenger count and travel date." },
  { step: "02", icon: CreditCard, headline: "Review Your Booking & Pay", supportingCopy: "Check the return date, applicable price and terms, then complete payment." },
  { step: "03", icon: Settings2, headline: "We Arrange Your Return Ticket", supportingCopy: "After payment, our team processes the reservation through the configured airline/partner process and completes the required verification." },
  { step: "04", icon: Send, headline: "Receive Your Ticket", supportingCopy: "Once issued, your return ticket is delivered to you." },
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
  // Client doc 2026-10-15 (J3) — photo and main wording from Admin → Website Pages (blank = this copy).
  const content = await getSitePageContent("return-ticket");
  const [documents, destinations] = await Promise.all([loadDocuments(), loadDestinations()]);
  // Client confirmation 2026-10-25 — every section's wording from Admin → Website Pages (the client's B11 list is the fallback).
  const paragraphs = (key: string): string[] => content.list(key).map((row) => row.join(" | "));
  const whatYoullNeed = content.list("requirements.whatYouNeed", 2).map(([label, detail]) => ({ label, detail: detail || undefined }));
  return (
    <>
      <section className="relative overflow-hidden">
        <ServiceHeroBackdrop service="RETURN_TICKET" imageSrc={content.heroImageUrl} />
        <Container className="relative flex flex-col items-center gap-6 pb-14 pt-8 text-center sm:pb-20 sm:pt-10">
          <MotionReveal>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <TicketCheck className="h-6 w-6" aria-hidden="true" />
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
              <ButtonLink href="/services/return-ticket/request" variant="primary" size="lg">{content.text("applyLabel")}</ButtonLink>
              <ButtonLink href={utilityLinks.trackStatus.href} variant="glass" size="lg">
                {content.text("heroButtons.trackLabel")}
              </ButtonLink>
            </div>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-10 sm:py-14">
        <Container className="flex flex-col items-center gap-4 text-center">
          <MotionReveal>
            <SectionHeading
              align="center"
              eyebrow={content.text("about.eyebrow")}
              title={content.text("about.title")}
              className="mx-auto"
            />
          </MotionReveal>
          <MotionReveal delay={0.06}>
            <p className="max-w-2xl text-sm text-ink-secondary sm:text-base">{content.text("about.intro")}</p>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-10 sm:py-14">
        <Container>
          <MotionReveal>
            <div className="flex max-w-3xl flex-col gap-4">
              <SectionHeading eyebrow={content.text("returnDate.eyebrow")} title={content.text("returnDate.title")} />
              <p className="text-sm text-ink-secondary sm:text-base">{content.text("returnDate.intro")}</p>
              <ul className="flex flex-col gap-2.5">
                {paragraphs("returnDate.points").map((point, index) => (
                  <li key={`${index}-${point}`} className="flex items-start gap-2.5 text-sm text-ink-secondary">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </MotionReveal>

        </Container>
      </section>

      <ServiceRequirementsSection
        whatYouNeed={whatYoullNeed}
        documents={returnTicketDocumentsForDisplay(documents)}
        notes={paragraphs("requirements.notes")}
        needTitle={content.text("requirements.needTitle")}
        documentsTitle={content.text("requirements.documentsTitle")}
      />

      <section className="py-10 sm:py-14">
        <Container className="flex flex-col gap-8">
          <MotionReveal>
            <SectionHeading align="center" eyebrow={content.text("howItWorks.eyebrow")} title={content.text("howItWorks.title")} className="mx-auto" />
          </MotionReveal>
          <VisaProcessSteps steps={content.steps(visaProcessSteps)} />
        </Container>
      </section>

      <VerificationTimingSection content={content} />

      <CancellationRefundSection destinations={destinations} content={content} />

      <DisclaimerAfterTravelSection content={content} />

      <ServiceFaqSection serviceType="RETURN_TICKET" title={content.text("faq.title")} />

      <section className="pb-14 sm:pb-20">
        <Container>
          <MotionReveal>
            <div className="surface-dark-block flex flex-col items-center gap-6 rounded-xl p-8 text-center sm:p-12">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-ink-on-dark-primary">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-ink-on-dark-primary sm:text-3xl">{content.text("ctaHeading")}</h2>
              <ButtonLink href="/services/return-ticket/request" variant="primary" size="lg">{content.text("applyLabel")}</ButtonLink>
            </div>
          </MotionReveal>
        </Container>
      </section>
    </>
  );
}
