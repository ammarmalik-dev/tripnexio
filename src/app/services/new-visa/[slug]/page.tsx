import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileText, Clock, MapPin, Briefcase, GraduationCap, Users, Baby, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { GlassCard } from "@/components/ui/GlassCard";
import { ServiceHeroBackdrop } from "@/components/services/ServiceHeroBackdrop";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { utilityLinks } from "@/lib/nav-config";
import { NewVisaProductSelector } from "@/components/services/new-visa/NewVisaProductSelector";
import { VisaProcessSteps } from "@/components/services/VisaProcessSteps";
import { ServiceFaqSection } from "@/components/services/ServiceFaqSection";
import { NewVisaRequirementsSection } from "@/components/services/new-visa/landing/NewVisaRequirementsSection";
import { NewVisaProcessingTimeSection } from "@/components/services/new-visa/landing/NewVisaProcessingTimeSection";
import { NewVisaValiditySection, NewVisaBeforeYouApplySection } from "@/components/services/new-visa/landing/NewVisaValidityAndNotesSections";
import { countryPageImageUrl, getPublishedCountryPage, newVisaApplyHref, type PublishedCountryPage } from "@/lib/new-visa/country-pages";

// Content, prices, timelines and FAQs are Admin-managed; refresh without a redeploy.
export const revalidate = 300;

interface PageProps {
  params: Promise<{ slug: string }>;
}


/** "UAE" from the eyebrow "UAE Visa"; otherwise the country's own name. */
function shortName(page: PublishedCountryPage): string {
  const fromEyebrow = page.heroEyebrow?.replace(/\s*visas?\s*$/i, "").trim();
  return fromEyebrow || page.country.name;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedCountryPage(slug).catch(() => null);
  if (!page) return { title: "New Visa" };
  const title = page.seoTitle ?? `${shortName(page)} Visa`;
  const description = page.seoDescription ?? page.heroSubtitle;
  return { title, description, openGraph: { title, description }, alternates: { canonical: `/services/new-visa/${page.slug}` } };
}

// Doc Â§5 "Visa Applications From Across India" â€” "minimal applicant icons," not a long occupation list.
const applicantProfileIcons = [MapPin, Briefcase, GraduationCap, Users];

export default async function NewVisaCountryPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPublishedCountryPage(slug);
  if (!page) notFound();

  const name = shortName(page);
  const applyHref = newVisaApplyHref(page.country.code);
  const applyLabel = `Apply for ${name} Visa`;
  const processSteps = [
    { step: "01", headline: "Apply online", supportingCopy: `Choose your ${name} visa option and submit your traveller details.` },
    { step: "02", headline: "Upload documents", supportingCopy: "Complete payment and upload the required documents." },
    { step: "03", headline: "We process your application", supportingCopy: "We coordinate the next steps and keep you updated." },
    { step: "04", headline: "Visa delivered", supportingCopy: "Receive your issued visa digitally once approved and issued." },
  ];

  return (
    <>
      <section className="relative overflow-hidden">
        <ServiceHeroBackdrop service="NEW_VISA" imageSrc={countryPageImageUrl(page.heroImageFileId)} />
        <Container className="relative flex flex-col items-center gap-6 py-20 text-center sm:py-28">
          <MotionReveal>
            <Link
              href="/services/new-visa"
              className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-1/80 px-3 py-1 text-xs font-medium text-ink-secondary backdrop-blur transition-colors hover:text-ink-primary"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              All destinations
            </Link>
          </MotionReveal>
          <MotionReveal delay={0.02}>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <FileText className="h-6 w-6" aria-hidden="true" />
            </span>
          </MotionReveal>
          {page.heroEyebrow ? (
            <MotionReveal delay={0.04}>
              <span className="text-sm font-medium tracking-wide text-ink-accent uppercase">{page.heroEyebrow}</span>
            </MotionReveal>
          ) : null}
          <MotionReveal delay={0.06}>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink-heading sm:text-5xl">{page.heroTitle}</h1>
          </MotionReveal>
          <MotionReveal delay={0.12}>
            <p className="max-w-xl text-base text-ink-secondary sm:text-lg">{page.heroSubtitle}</p>
          </MotionReveal>
          <MotionReveal delay={0.18}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href={applyHref} variant="primary" size="lg">
                {applyLabel}
              </ButtonLink>
              <ButtonLink href={utilityLinks.trackStatus.href} variant="glass" size="lg">
                Track Application
              </ButtonLink>
            </div>
          </MotionReveal>
        </Container>
      </section>

      {page.introHeading || page.introBody ? (
        <section className="py-16 sm:py-20">
          <Container>
            <MotionReveal>
              <div className="mx-auto flex max-w-3xl flex-col gap-4">
                <SectionHeading eyebrow="What is a New Visa Request?" title={page.introHeading ?? `Your ${name} visa application, guided end to end`} />
                {page.introBody ? <p className="whitespace-pre-line text-sm text-ink-secondary sm:text-base">{page.introBody}</p> : null}
              </div>
            </MotionReveal>
          </Container>
        </section>
      ) : null}

      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-6">
          <MotionReveal>
            <SectionHeading align="center" eyebrow={`${name} visa options`} title="Choose your visa and see the price instantly" className="mx-auto" />
          </MotionReveal>
          <MotionReveal delay={0.08}>
            <div className="mx-auto w-full max-w-2xl">
              <NewVisaProductSelector countryCode={page.country.code} />
            </div>
          </MotionReveal>
        </Container>
      </section>

      {page.applicantsHeading || page.applicantsBody ? (
        <section className="py-16 sm:py-20">
          <Container className="flex flex-col items-center gap-5 text-center">
            <MotionReveal>
              <SectionHeading align="center" title={page.applicantsHeading ?? `${name} Visa Applications From Across India`} className="mx-auto" />
            </MotionReveal>
            {page.applicantsBody ? (
              <MotionReveal delay={0.06}>
                <p className="max-w-xl text-sm text-ink-secondary sm:text-base">{page.applicantsBody}</p>
              </MotionReveal>
            ) : null}
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
      ) : null}

      <NewVisaRequirementsSection whatYouNeed={page.whatYouNeed} documents={page.documents} documentsNote={page.documentsNote} />

      {page.childrenNote ? (
        <section className="py-16 sm:py-20">
          <Container>
            <MotionReveal>
              <GlassCard tier={2} className="mx-auto flex max-w-3xl flex-col items-start gap-4 p-6 sm:flex-row sm:p-8">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <Baby className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-2">
                  <h2 className="text-xl font-semibold text-ink-heading sm:text-2xl">Travelling with children</h2>
                  <p className="text-sm text-ink-secondary sm:text-base">{page.childrenNote}</p>
                </div>
              </GlassCard>
            </MotionReveal>
          </Container>
        </section>
      ) : null}

      <NewVisaProcessingTimeSection />

      <section className="py-16 sm:py-20">
        <Container className="flex flex-col gap-12">
          <MotionReveal>
            <SectionHeading align="center" eyebrow="The visa process" title="How it works" className="mx-auto" />
          </MotionReveal>
          <VisaProcessSteps steps={processSteps} sampleStatusText="Your visa application is being processed." />
        </Container>
      </section>

      <NewVisaValiditySection validityText={page.validityText} stayText={page.stayText} />

      <NewVisaBeforeYouApplySection items={page.beforeYouApply} />

      <ServiceFaqSection serviceType="NEW_VISA" countryId={page.country.id} />

      <section className="pb-20 sm:pb-28">
        <Container>
          <MotionReveal>
            <div className="surface-dark-block flex flex-col items-center gap-6 rounded-xl p-8 text-center sm:p-12">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-ink-on-dark-primary">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-ink-on-dark-primary sm:text-3xl">
                {page.ctaHeading ?? `Ready to apply for your ${name} visa?`}
              </h2>
              <p className="max-w-xl text-sm text-ink-on-dark-secondary sm:text-base">
                {page.ctaBody ?? "Choose your visa option, enter your traveller details and complete your application online."}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <ButtonLink href={applyHref} variant="primary" size="lg">
                  {applyLabel}
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
