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
import { getSitePageContent } from "@/lib/site-content/get-page-content";

// FAQs (Admin Faq rows) are DB-backed. No prices on this page (client correction 2026-10-05).
export const revalidate = 300;

export const metadata: Metadata = {
  title: "OTB — OK to Board",
  description:
    "OK to Board (OTB) airline clearance for Indian ECR passport holders travelling from India — request online and TripNexio coordinates the update with the relevant airline before you travel.",
};

// Locked content — TripNexio_OTB_Final_Page_Content_Design_FAQ_v3.docx §5/§8/§19 and the client's lists
// (2026-10-05 documents, 2026-10-09 B15 "What You'll Need") now live as the fallbacks in
// src/lib/site-content/sections/otb.ts, editable in Admin → Website Pages (client confirmation 2026-10-25).

// Client correction 2026-10-05 — exactly 4 steps.
const otbProcessSteps = [
  { step: "01", icon: PlaneTakeoff, headline: "Share Your Flight Details", supportingCopy: "Enter your airline, travel date and contact details." },
  { step: "02", icon: FileCheck2, headline: "Submit Your Documents & Pay", supportingCopy: "Provide the required documents, review the applicable service details and complete payment." },
  { step: "03", icon: Network, headline: "We Process Your OTB", supportingCopy: "TripNexio coordinates the request through the relevant airline/process channel." },
  { step: "04", icon: BadgeCheck, headline: "Get Your OTB Confirmation", supportingCopy: "Once the airline confirms the OTB, we share the confirmation/reference with you and update your status via WhatsApp and email." },
];

export default async function OtbLandingPage() {
  // Client doc 2026-10-15 (J3) — photo and main wording from Admin → Website Pages (blank = this copy).
  const content = await getSitePageContent("otb");
  // A paragraph list: one paragraph per line ("|" inside a paragraph is kept as typed).
  const paragraphs = (key: string): string[] => content.list(key).map((row) => row.join(" | "));
  const whatYoullNeed = content.list("requirements.whatYouNeed", 2).map(([label, detail]) => ({ label, detail: detail || undefined }));
  const documentsNeeded = content
    .list("requirements.documents", 2)
    .map(([name, caption]) => ({ name, required: true, caption: caption || undefined }));
  const ecrEcnrSupport = content.list("ecrEcnr.cards", 2).map(([title, description]) => ({ title, description }));
  return (
    <>
      <section className="relative overflow-hidden">
        <ServiceHeroBackdrop service="OTB" imageSrc={content.heroImageUrl} />
        <Container className="relative flex flex-col items-center gap-6 pb-14 pt-8 text-center sm:pb-20 sm:pt-10">
          <MotionReveal>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <PlaneTakeoff className="h-6 w-6" aria-hidden="true" />
            </span>
          </MotionReveal>
          <MotionReveal delay={0.04}>
            <span className="text-sm font-medium tracking-wide text-ink-accent uppercase">{content.text("heroEyebrow")}</span>
          </MotionReveal>
          <MotionReveal delay={0.05}>
            {/* P18 — OTB Page Content v3 hero badge. */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-on-light">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {content.text("heroBadge")}
            </span>
          </MotionReveal>
          <MotionReveal delay={0.06}>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink-heading sm:text-5xl">{content.text("heroTitle")}</h1>
          </MotionReveal>
          <MotionReveal delay={0.12}>
            <p className="max-w-xl text-base text-ink-secondary sm:text-lg">{content.text("heroSubtitle")}</p>
          </MotionReveal>
          <MotionReveal delay={0.15}>
            <p className="text-sm font-medium text-ink-tertiary">{content.text("heroTagline")}</p>
          </MotionReveal>
          <MotionReveal delay={0.18}>
            <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
              <ButtonLink href="/services/otb/request" variant="primary" size="lg">{content.text("applyLabel")}</ButtonLink>
              <ButtonLink href={utilityLinks.trackStatus.href} variant="glass" size="lg">
                {content.text("heroButtons.trackLabel")}
              </ButtonLink>
            </div>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-10 sm:py-14">
        <Container className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          <MotionReveal>
            <div className="flex flex-col gap-4">
              <SectionHeading eyebrow={content.text("about.eyebrow")} title={content.text("about.title")} />
              <p className="text-sm text-ink-secondary sm:text-base">{content.text("about.intro")}</p>
            </div>
          </MotionReveal>

          <MotionReveal delay={0.08}>
            <GlassCard tier={2} className="flex flex-col gap-4 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <BadgeCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="flex flex-col">
                  <span className="text-xs font-medium tracking-wide text-ink-accent uppercase">{content.text("about.cardEyebrow")}</span>
                  <h3 className="text-base font-semibold text-ink-heading">{content.text("about.cardTitle")}</h3>
                </div>
              </div>
              {paragraphs("about.cardParagraphs").map((paragraph, index) => (
                <p key={index} className="text-sm text-ink-secondary">
                  {paragraph}
                </p>
              ))}
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
              eyebrow={content.text("ecrEcnr.eyebrow")}
              title={content.text("ecrEcnr.title")}
              className="mx-auto"
            />
          </MotionReveal>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {ecrEcnrSupport.map((item, index) => (
              <MotionReveal key={index} delay={index * 0.06} className="h-full">
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
              {content.text("ecrEcnr.note")}
            </p>
          </MotionReveal>
        </Container>
      </section>

      <section className="py-10 sm:py-14">
        <Container className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          <MotionReveal className="h-full">
            <GlassCard tier={2} className="flex h-full flex-col gap-3 p-6 sm:p-8">
              <span className="text-xs font-medium tracking-wide text-ink-accent uppercase">{content.text("departure.eyebrow")}</span>
              <h2 className="text-base font-semibold text-ink-heading">{content.text("departure.title")}</h2>
              {paragraphs("departure.paragraphs").map((paragraph, index) => (
                <p key={index} className="text-sm text-ink-secondary">
                  {paragraph}
                </p>
              ))}
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
                  <span className="text-xs font-medium tracking-wide text-ink-accent uppercase">{content.text("departure.networkEyebrow")}</span>
                  <h2 className="text-base font-semibold text-ink-heading">{content.text("departure.networkTitle")}</h2>
                </div>
              </div>
              {paragraphs("departure.networkParagraphs").map((paragraph, index) => (
                <p key={index} className="text-sm text-ink-secondary">
                  {paragraph}
                </p>
              ))}
            </GlassCard>
          </MotionReveal>
        </Container>
      </section>

      <ServiceRequirementsSection
        whatYouNeed={whatYoullNeed}
        documents={documentsNeeded}
        notes={paragraphs("requirements.notes")}
        needTitle={content.text("requirements.needTitle")}
        documentsTitle={content.text("requirements.documentsTitle")}
      />

      <section className="py-10 sm:py-14">
        <Container className="flex flex-col gap-8">
          <MotionReveal>
            <SectionHeading align="center" eyebrow={content.text("howItWorks.eyebrow")} title={content.text("howItWorks.title")} className="mx-auto" />
          </MotionReveal>
          <VisaProcessSteps steps={content.steps(otbProcessSteps)} />
        </Container>
      </section>

      <section className="py-10 sm:py-14">
        <Container>
          <MotionReveal>
            <div className="surface-dark-block flex flex-col gap-3 rounded-xl p-6 text-center sm:p-10">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-ink-on-dark-primary">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold text-ink-on-dark-primary">{content.text("processing.title")}</h2>
              <p className="mx-auto max-w-xl text-sm text-ink-on-dark-secondary">
                {content.text("processing.body")}
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
              <h2 className="text-lg font-semibold text-ink-heading">{content.text("returnApproval.returnTitle")}</h2>
              <p className="text-sm text-ink-secondary">{content.text("returnApproval.returnBody")}</p>
              <div className="mt-auto pt-2">
                <ButtonLink href="/services/return-ticket" variant="primary" size="md">
                  {content.text("returnApproval.returnButton")}
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
                <span className="text-xs font-medium tracking-wide text-ink-accent uppercase">{content.text("returnApproval.approvalEyebrow")}</span>
                <h2 className="text-lg font-semibold text-ink-heading">{content.text("returnApproval.approvalTitle")}</h2>
              </div>
              <p className="text-sm text-ink-secondary">{content.text("returnApproval.approvalBody")}</p>
              <div role="note" className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                <p className="text-xs text-ink-primary sm:text-sm">
                  <span className="font-semibold">{content.text("returnApproval.importantLabel")} </span>
                  {content.text("returnApproval.importantText")}
                </p>
              </div>
            </GlassCard>
          </MotionReveal>
        </Container>
      </section>

      <ServiceFaqSection serviceType="OTB" title={content.text("faq.title")} />

      <section className="pb-14 sm:pb-20">
        <Container>
          <MotionReveal>
            <div className="surface-dark-block flex flex-col items-center gap-6 rounded-xl p-8 text-center sm:p-12">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-ink-on-dark-primary">
                <PlaneTakeoff className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-ink-on-dark-primary sm:text-3xl">{content.text("ctaHeading")}</h2>
              <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
                <ButtonLink href="/services/otb/request" variant="primary" size="lg">{content.text("applyLabel")}</ButtonLink>
                <ButtonLink href="/services/return-ticket" variant="ghost" size="lg" className="border-white/40 text-white hover:border-white/70 hover:bg-white/5">
                  {content.text("closing.returnButton")}
                </ButtonLink>
              </div>
            </div>
          </MotionReveal>
        </Container>
      </section>
    </>
  );
}
