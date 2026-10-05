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

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden">
        <HeroImage />
        <Container className="relative flex flex-col items-center gap-8 pb-16 pt-20 text-center sm:pb-24 sm:pt-28">
          <MotionReveal>
            <span className="text-xs font-semibold tracking-wide text-ink-accent">
              Visa &middot; Flights &middot; OTB
            </span>
          </MotionReveal>

          <MotionReveal delay={0.08}>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-ink-heading sm:text-6xl">
              Travel Made Easy with{" "}
              <span className="text-gradient-accent">TripNexio</span>
            </h1>
          </MotionReveal>

          <MotionReveal delay={0.16}>
            <p className="max-w-xl text-base text-ink-secondary sm:text-lg">
              Tell us what you need &mdash; visa, flights or OTB &mdash; and
              we&rsquo;ll guide you through a simple process from request to
              result.
            </p>
          </MotionReveal>

          <MotionReveal delay={0.24}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href={headerActions.getStarted.href} variant="primary" size="lg">
                Explore Services
              </ButtonLink>
              <ButtonLink href={utilityLinks.trackStatus.href} variant="glass" size="lg">
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
