import type { LucideIcon } from "lucide-react";
import { BadgePercent, Plane, Layers } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";

interface FareSourceCard {
  icon: LucideIcon;
  title: string;
  body: string;
}

// Locked content — doc §4 "How Fares Work" (three compact cards).
const fareSourceCards: FareSourceCard[] = [
  {
    icon: BadgePercent,
    title: "Special Inventory",
    body: "Group or pre-purchased inventory may provide discounted fares on selected routes and dates.",
  },
  {
    icon: Plane,
    title: "Regular Offline Fares",
    body: "Our team can also check normal fares through airline and agency sources.",
  },
  {
    icon: Layers,
    title: "Multiple Options",
    body: "Where available, you may receive more than one airline, timing or route option.",
  },
];

/** Doc §4 — "Fares are checked, not searched live" + the three fare-source cards. */
export function FareSourceCards() {
  return (
    <section className="py-16 sm:py-20">
      <Container className="flex flex-col gap-10">
        <MotionReveal>
          <SectionHeading
            align="center"
            eyebrow="Fares are checked, not searched live"
            title="We check the market for you"
            description="There is no public live fare search or live airline inventory. Our team checks available special inventory, group-sourced fares and regular offline fares through configured airline, agency and partner sources, then sends you the available options."
            className="mx-auto"
          />
        </MotionReveal>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          {fareSourceCards.map(({ icon: Icon, title, body }, index) => (
            <li key={title}>
              <MotionReveal delay={index * 0.06} className="h-full">
                <GlassCard tier={2} className="flex h-full flex-col gap-3 p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold text-ink-heading">{title}</h3>
                  <p className="text-sm text-ink-secondary">{body}</p>
                </GlassCard>
              </MotionReveal>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
