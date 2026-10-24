import { ClipboardList, FileCheck2, Send, Bell, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MotionReveal } from "@/components/motion/MotionReveal";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

// Client confirmation 2026-10-25 — the steps' wording comes from Admin → Website Pages; icons stay by position.
const STEP_ICONS = [ClipboardList, FileCheck2, Send, Bell, ShieldCheck];

export function HowItWorks({ content }: { content: SitePageContentView }) {
  const steps = content.list("howItWorks.steps", 2).map(([title, description], index) => ({
    step: String(index + 1).padStart(2, "0"),
    title,
    description,
    icon: STEP_ICONS[index % STEP_ICONS.length],
  }));
  return (
    <section id="how-it-works" className="py-14 sm:py-20">
      <Container className="flex flex-col gap-10">
        <MotionReveal>
          <SectionHeading
            align="center"
            eyebrow={content.text("howItWorks.eyebrow")}
            title={content.text("howItWorks.title")}
            className="mx-auto"
          />
        </MotionReveal>

        <div className="relative grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-5">
          <div
            className="absolute left-[10%] right-[10%] top-6 hidden border-t border-dashed border-hairline sm:block"
            aria-hidden="true"
          />
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <MotionReveal key={`${step.step}-${step.title}`} delay={index * 0.06}>
                <div className="relative flex flex-col items-center gap-2 text-center">
                  <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="relative z-10 flex h-5 w-8 items-center justify-center rounded-sm bg-surface-dark text-[10px] font-semibold text-ink-on-dark-primary">
                    {step.step}
                  </span>
                  <p className="mt-1 text-sm font-semibold text-ink-heading">{step.title}</p>
                  <p className="text-xs text-ink-tertiary">{step.description}</p>
                </div>
              </MotionReveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
