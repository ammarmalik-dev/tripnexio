import { HeroImage } from "@/components/home/HeroImage";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ServicesGrid } from "@/components/home/ServicesGrid";
import { HowItWorks } from "@/components/home/HowItWorks";
import { TrackJourneyPreview } from "@/components/home/TrackJourneyPreview";
import { WhyChooseUs } from "@/components/home/WhyChooseUs";
import { AboutSection } from "@/components/home/AboutSection";
import { SupportPayment } from "@/components/home/SupportPayment";
import { CtaBanner } from "@/components/home/CtaBanner";
import { headerActions, utilityLinks } from "@/lib/nav-config";
import { getSitePageContent } from "@/lib/site-content/get-page-content";

/** "Travel Made Easy with TripNexio" → the brand name in the accent gradient, wherever Admin put it. */
function highlightBrand(title: string) {
  const at = title.indexOf("TripNexio");
  if (at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <span className="text-gradient-accent">TripNexio</span>
      {title.slice(at + "TripNexio".length)}
    </>
  );
}

export default async function Home() {
  // Client doc 2026-10-15 (J3) — photo and hero wording from Admin → Website Pages (blank = this copy).
  const content = await getSitePageContent("home");
  const subtitle = content.text("heroSubtitle");
  return (
    <>
      <section className="relative overflow-hidden">
        <HeroImage imageSrc={content.heroImageUrl} />
        <Container className="relative flex flex-col items-center gap-8 pb-16 pt-12 text-center sm:pb-24 sm:pt-16">
          <MotionReveal>
            <span className="text-xs font-semibold tracking-wide text-ink-accent">{content.text("heroEyebrow")}</span>
          </MotionReveal>

          <MotionReveal delay={0.08}>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-ink-heading sm:text-6xl">
              {highlightBrand(content.text("heroTitle"))}
            </h1>
          </MotionReveal>

          {subtitle ? (
            <MotionReveal delay={0.12}>
              <p className="max-w-xl text-base text-ink-secondary sm:text-lg">{subtitle}</p>
            </MotionReveal>
          ) : null}

          <MotionReveal delay={0.16} className="w-full sm:w-auto">
            {/* Client 2026-10-14 — the hero background text is removed, and both buttons sit on one line on phones too. */}
            <div className="mx-auto flex w-full max-w-sm items-center justify-center gap-2.5 sm:max-w-none sm:gap-3">
              <ButtonLink href={headerActions.getStarted.href} variant="primary" size="lg" className="h-11 min-w-0 flex-1 justify-center whitespace-nowrap px-3 text-sm sm:h-13 sm:flex-none sm:px-7 sm:text-base">
                {content.text("applyLabel")}
              </ButtonLink>
              <ButtonLink href={utilityLinks.trackStatus.href} variant="glass" size="lg" className="h-11 min-w-0 flex-1 justify-center whitespace-nowrap px-3 text-sm sm:h-13 sm:flex-none sm:px-7 sm:text-base">
                Track Status
              </ButtonLink>
            </div>
          </MotionReveal>
        </Container>
      </section>

      <ServicesGrid />
      <HowItWorks />
      <TrackJourneyPreview />
      <WhyChooseUs />
      <AboutSection />
      <CtaBanner />
      <SupportPayment />
    </>
  );
}
