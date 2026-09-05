import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { GradientMesh } from "@/components/motion/GradientMesh";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { AiChatShell } from "@/components/ai/AiChatShell";

export const metadata: Metadata = {
  title: "Ask TripNexio AI",
  description: "Ask TripNexio AI about visa and flight services — a preview that connects you to our support team.",
};

interface AiPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function AskAiPage({ searchParams }: AiPageProps) {
  const { q } = await searchParams;

  return (
    <section className="relative overflow-hidden py-16 sm:py-20">
      <GradientMesh />
      <Container className="relative flex flex-col items-center gap-8">
        <MotionReveal className="flex flex-col items-center gap-3 text-center">
          <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-ink-heading sm:text-4xl">
            Ask TripNexio AI
          </h1>
          <p className="max-w-lg text-sm text-ink-secondary sm:text-base">
            A quick preview of what&rsquo;s coming — for now, it connects you
            straight to our support team.
          </p>
        </MotionReveal>

        <MotionReveal delay={0.08} className="w-full max-w-xl">
          <AiChatShell initialQuery={q} />
        </MotionReveal>
      </Container>
    </section>
  );
}
