import { FileSearch, FileCheck2, PlaneTakeoff, RotateCcw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

// Locked content — OTB Page Content v3 §17 "Cancellation & Refund".
const refundStages: { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: "Before document validation",
    description:
      "Gateway charges are non-refundable; the remaining eligible amount is refunded according to the configured policy.",
    icon: FileSearch,
  },
  {
    title: "After document validation",
    description: "₹250 service charge + applicable gateway charges are deducted from the eligible refund.",
    icon: FileCheck2,
  },
  {
    title: "After airline processing",
    description: "No refund under the current OTB business rules.",
    icon: PlaneTakeoff,
  },
  {
    title: "TripNexio unable to process before airline processing",
    description: "Applicable refund process is initiated and the reason is recorded.",
    icon: RotateCcw,
  },
];

export function OtbCancellationRefundSection() {
  return (
    <section className="py-16 sm:py-20">
      <Container className="flex flex-col gap-10">
        <MotionReveal>
          <SectionHeading align="center" eyebrow="Cancellation & Refund" title="Cancellation & Refund" className="mx-auto" />
        </MotionReveal>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {refundStages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <MotionReveal key={stage.title} delay={index * 0.05} className="h-full">
                <GlassCard tier={2} className="flex h-full flex-col gap-3 p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold text-ink-heading">{stage.title}</h3>
                  <p className="text-sm text-ink-secondary">{stage.description}</p>
                </GlassCard>
              </MotionReveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
