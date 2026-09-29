import { Timer, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { getServiceTimelineRules } from "@/lib/settings/service-timeline-config";

interface MinTravelDays {
  normal: number | null;
  express: number | null;
}

/**
 * The Admin-configured minimum planned travel timelines (Admin → Timelines /
 * SLA). Unconfigured or unreachable → null, and the card falls back to
 * neutral copy rather than a hard-coded number.
 */
async function loadMinTravelDays(): Promise<MinTravelDays> {
  try {
    const rules = await getServiceTimelineRules("NEW_VISA");
    return { normal: rules.minTravelDaysNormal, express: rules.minTravelDaysExpress };
  } catch (error) {
    console.error("[new-visa-landing] couldn't load processing timelines", error);
    return { normal: null, express: null };
  }
}

function timelineCopy(days: number | null): string {
  if (days === null || days <= 0) return "Minimum planned travel timeline shown when you apply.";
  return `Minimum planned travel timeline: ${days} ${days === 1 ? "day" : "days"}`;
}

/** New Visa landing — Normal / Express processing cards (doc §8). */
export async function NewVisaProcessingTimeSection() {
  const days = await loadMinTravelDays();
  const options: { title: string; copy: string; Icon: LucideIcon }[] = [
    { title: "Normal", copy: timelineCopy(days.normal), Icon: Timer },
    { title: "Express", copy: timelineCopy(days.express), Icon: Zap },
  ];

  return (
    <section className="py-16 sm:py-20">
      <Container className="flex flex-col gap-8">
        <MotionReveal>
          <SectionHeading align="center" title="Processing time" className="mx-auto" />
        </MotionReveal>
        <ul className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
          {options.map(({ title, copy, Icon }, index) => (
            <li key={title} className="h-full">
              <MotionReveal delay={index * 0.06} className="h-full">
                <GlassCard tier={2} className="flex h-full flex-col gap-3 p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-lg font-semibold text-ink-heading">{title}</h3>
                  <p className="text-sm text-ink-secondary sm:text-base">{copy}</p>
                </GlassCard>
              </MotionReveal>
            </li>
          ))}
        </ul>
        <MotionReveal delay={0.12}>
          <p className="mx-auto max-w-2xl text-center text-sm text-ink-secondary">
            Processing timelines depend on document readiness, working days, holidays, configured service timelines and authority
            processing. Processing type does not guarantee visa approval or a fixed authority decision time.
          </p>
        </MotionReveal>
      </Container>
    </section>
  );
}
