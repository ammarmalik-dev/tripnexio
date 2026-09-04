import { HeroCarousel } from "@/components/motion/HeroCarousel";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { AiAskBar } from "@/components/home/AiAskBar";
import { ServicesGrid } from "@/components/home/ServicesGrid";
import { headerActions, utilityLinks } from "@/lib/nav-config";

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden">
        <HeroCarousel />
        <Container className="relative flex flex-col items-center gap-8 py-28 text-center sm:pb-20 sm:pt-36">
          <MotionReveal>
            <span className="inline-flex items-center rounded-pill border border-hairline px-4 py-1.5 text-xs font-medium tracking-wide text-ink-secondary">
              Visa &middot; Flights &middot; OTB
            </span>
          </MotionReveal>

          <MotionReveal delay={0.08}>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-ink-primary sm:text-6xl">
              Your UAE travel,{" "}
              <span className="text-gradient-accent">simplified.</span>
            </h1>
          </MotionReveal>

          <MotionReveal delay={0.16}>
            <p className="max-w-xl text-base text-ink-secondary sm:text-lg">
              Tell us what you need — visa, flights or OTB — and we&rsquo;ll
              guide you through a clear, guided process from request to
              result.
            </p>
          </MotionReveal>

          <MotionReveal delay={0.24}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href={headerActions.getStarted.href} variant="primary" size="lg">
                Browse Services
              </ButtonLink>
              <ButtonLink href={utilityLinks.trackStatus.href} variant="ghost" size="lg">
                Track Status
              </ButtonLink>
            </div>
          </MotionReveal>
        </Container>
      </section>

      <Container className="relative z-10 -mt-8 sm:-mt-10">
        <MotionReveal delay={0.32} className="mx-auto w-full max-w-2xl">
          <AiAskBar />
        </MotionReveal>
      </Container>

      <ServicesGrid />
    </>
  );
}
