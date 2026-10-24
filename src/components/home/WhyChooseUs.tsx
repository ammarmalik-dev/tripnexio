import { Sparkles, Headset, Eye, CalendarCheck, ShieldCheck, Headphones } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MotionReveal } from "@/components/motion/MotionReveal";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

// Locked copy — Homepage_FINAL_Locked_1of1.docx §7 (now the fallback in src/lib/site-content/sections/home.ts).
// Client confirmation 2026-10-25 — Admin edits the wording; icons stay by position.
const REASON_ICONS = [Sparkles, Headset, Eye, CalendarCheck, ShieldCheck, Headphones];

export function WhyChooseUs({ content }: { content: SitePageContentView }) {
  const reasons = content.list("why.cards", 2).map(([title, description], index) => ({
    title,
    description,
    icon: REASON_ICONS[index % REASON_ICONS.length],
  }));
  return (
    <section className="py-14 sm:py-20">
      <Container className="flex flex-col gap-10">
        <MotionReveal>
          <SectionHeading eyebrow={content.text("why.eyebrow")} title={content.text("why.title")} />
        </MotionReveal>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
          {reasons.map((reason, index) => {
            const Icon = reason.icon;
            return (
              <MotionReveal key={`${index}-${reason.title}`} delay={index * 0.05}>
                <div className="flex flex-col gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full text-accent-on-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold text-ink-heading">{reason.title}</p>
                  <p className="text-xs text-ink-tertiary">{reason.description}</p>
                </div>
              </MotionReveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
