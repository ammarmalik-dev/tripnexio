import { Scale, PlaneLanding } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

/**
 * P19 — RVT Page Content v3 §12 "Travel & Immigration Disclaimer" and §13 "After Travel" (locked copy, now the
 * fallback in src/lib/site-content/sections/return-ticket.ts, editable in Admin → Website Pages).
 */
export function DisclaimerAfterTravelSection({ content }: { content: SitePageContentView }) {
  const paragraphs = (key: string): string[] => content.list(key).map((row) => row.join(" | "));
  return (
    <section className="py-10 sm:py-14">
      <Container className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MotionReveal className="h-full">
          <GlassCard tier={2} className="flex h-full flex-col gap-3 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <Scale className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-base font-semibold text-ink-heading">{content.text("disclaimer.title")}</h2>
            </div>
            {paragraphs("disclaimer.paragraphs").map((paragraph, index) => (
              <p key={`${index}-${paragraph}`} className="text-sm text-ink-secondary">
                {paragraph}
              </p>
            ))}
          </GlassCard>
        </MotionReveal>

        <MotionReveal delay={0.08} className="h-full">
          <GlassCard tier={2} className="flex h-full flex-col gap-3 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                <PlaneLanding className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-medium tracking-wide text-ink-accent uppercase">{content.text("disclaimer.afterEyebrow")}</span>
                <h2 className="text-base font-semibold text-ink-heading">{content.text("disclaimer.afterTitle")}</h2>
              </div>
            </div>
            {paragraphs("disclaimer.afterParagraphs").map((paragraph, index) => (
              <p key={`${index}-${paragraph}`} className="text-sm text-ink-secondary">
                {paragraph}
              </p>
            ))}
          </GlassCard>
        </MotionReveal>
      </Container>
    </section>
  );
}
