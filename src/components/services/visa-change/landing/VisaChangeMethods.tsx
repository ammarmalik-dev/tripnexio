import { Bus, Plane, Route } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

// Locked content — doc §6 "Choose Your Visa Change Method".
const methods = [
  {
    title: "Airport-to-Airport",
    description:
      "Exit the UAE by air through a confirmed airport-to-airport arrangement. We confirm the available airport, airline, flight and timing before you choose.",
    Icon: Plane,
  },
  {
    title: "Border Exit",
    description:
      "Exit the UAE through a confirmed land-border arrangement. We confirm the border, pickup and reporting details before you choose.",
    Icon: Bus,
  },
] as const;

/** Doc §6 method cards + §6A "How Airports and Borders Work". */
export function VisaChangeMethods() {
  return (
    <section className="py-16 sm:py-20">
      <Container className="flex flex-col gap-10">
        <MotionReveal>
          <SectionHeading
            align="center"
            eyebrow="Choose your method"
            title="Choose how you want to exit the UAE"
            className="mx-auto"
          />
        </MotionReveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {methods.map(({ title, description, Icon }, index) => (
            <MotionReveal key={title} delay={index * 0.06}>
              <GlassCard tier={2} className="flex h-full flex-col gap-4 p-6 sm:p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-semibold text-ink-heading">{title}</h3>
                <p className="text-sm text-ink-secondary sm:text-base">{description}</p>
              </GlassCard>
            </MotionReveal>
          ))}
        </div>

        <MotionReveal delay={0.1}>
          <GlassCard tier={1} className="flex flex-col gap-3 p-6 sm:flex-row sm:items-start sm:gap-6 sm:p-8">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
              <Route className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium tracking-wide text-ink-accent uppercase">
                How airports and borders work
              </span>
              <h3 className="text-lg font-semibold text-ink-heading">You choose the method. We confirm the route.</h3>
              <p className="text-sm text-ink-secondary sm:text-base">
                You do not need to choose a specific airport or border crossing. Select Airport-to-Airport or
                Border Exit, and our team confirms the available route, date, time and operational details. You
                will only see confirmed options available for your Visa Change.
              </p>
            </div>
          </GlassCard>
        </MotionReveal>
      </Container>
    </section>
  );
}
