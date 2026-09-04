import { HeroCarousel } from "@/components/motion/HeroCarousel";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { Container } from "@/components/ui/Container";
import { QuickStartBar } from "@/components/quick-start/QuickStartBar";
import { DestinationsGrid } from "@/components/home/DestinationsGrid";

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden">
        <HeroCarousel />
        <Container className="relative flex flex-col items-center gap-8 py-28 text-center sm:py-36">
          <MotionReveal>
            <span className="inline-flex items-center rounded-pill border border-hairline px-4 py-1.5 text-xs font-medium tracking-wide text-ink-secondary">
              India &rarr; UAE &amp; GCC visa and flight services
            </span>
          </MotionReveal>

          <MotionReveal delay={0.08}>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-ink-primary sm:text-6xl">
              Your journey to the Gulf,{" "}
              <span className="text-gradient-accent">handled end to end.</span>
            </h1>
          </MotionReveal>

          <MotionReveal delay={0.16}>
            <p className="max-w-xl text-base text-ink-secondary sm:text-lg">
              Submit a request for visas or flights to the UAE, Saudi Arabia,
              Bahrain, Kuwait, Oman or Qatar — our team takes it from there
              with vendors and airlines.
            </p>
          </MotionReveal>

          <MotionReveal delay={0.24} className="w-full max-w-3xl">
            <QuickStartBar />
          </MotionReveal>
        </Container>
      </section>

      <DestinationsGrid />
    </>
  );
}
