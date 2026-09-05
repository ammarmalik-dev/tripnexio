import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GradientMesh } from "@/components/motion/GradientMesh";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { TrackStatusExplorer } from "@/components/track/TrackStatusExplorer";

export const metadata: Metadata = {
  title: "Track Status",
  description: "Track the status of your visa or flight request with your booking or reference ID.",
};

interface TrackPageProps {
  searchParams: Promise<{ ref?: string }>;
}

export default async function TrackStatusPage({ searchParams }: TrackPageProps) {
  const { ref } = await searchParams;

  return (
    <>
      <section className="relative overflow-hidden">
        <GradientMesh />
        <Container className="relative flex flex-col items-center gap-6 py-20 text-center sm:py-24">
          <MotionReveal>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <Compass className="h-6 w-6" aria-hidden="true" />
            </span>
          </MotionReveal>
          <MotionReveal delay={0.06}>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-ink-heading sm:text-5xl">
              Track Your Request
            </h1>
          </MotionReveal>
          <MotionReveal delay={0.12}>
            <p className="max-w-xl text-base text-ink-secondary sm:text-lg">
              Enter your booking or reference ID to see where your request
              stands — from submission to confirmation.
            </p>
          </MotionReveal>
        </Container>
      </section>

      <section className="pb-20 sm:pb-28">
        <Container className="mx-auto max-w-3xl">
          <MotionReveal delay={0.08}>
            <TrackStatusExplorer initialReferenceId={ref} />
          </MotionReveal>
        </Container>
      </section>
    </>
  );
}
