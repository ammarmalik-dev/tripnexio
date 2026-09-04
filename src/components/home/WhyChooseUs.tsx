import { Sparkles, Zap, Eye, Activity, SlidersHorizontal, Headset } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MotionReveal } from "@/components/motion/MotionReveal";

const reasons = [
  {
    title: "AI-assisted",
    description: "Smart guidance while you're picking a service.",
    icon: Sparkles,
  },
  {
    title: "Automated",
    description: "Connected systems reduce manual back-and-forth.",
    icon: Zap,
  },
  {
    title: "Transparent",
    description: "Clear timelines, status and pricing, every step.",
    icon: Eye,
  },
  {
    title: "Real-time visibility",
    description: "Know what's happening with your request, every day.",
    icon: Activity,
  },
  {
    title: "Customer control",
    description: "See status, upload documents and make edits easily.",
    icon: SlidersHorizontal,
  },
  {
    title: "Human support",
    description: "Real experts when you need us.",
    icon: Headset,
  },
];

export function WhyChooseUs() {
  return (
    <section className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <MotionReveal>
          <SectionHeading eyebrow="Why choose us" title="Why choose TripNexio?" />
        </MotionReveal>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
          {reasons.map((reason, index) => {
            const Icon = reason.icon;
            return (
              <MotionReveal key={reason.title} delay={index * 0.05}>
                <div className="flex flex-col gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full text-accent-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold text-ink-primary">{reason.title}</p>
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
