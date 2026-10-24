import type { LucideIcon } from "lucide-react";
import { BadgePercent, Plane, Layers } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { MotionReveal } from "@/components/motion/MotionReveal";
import type { SitePageContentView } from "@/lib/site-content/get-page-content";

// Locked content — doc §4 "How Fares Work" (three compact cards); the wording is edited in Admin → Website Pages, icons cycle by position.
const fareSourceIcons: LucideIcon[] = [BadgePercent, Plane, Layers];

interface FareSourceCardsProps {
  content: SitePageContentView;
}

/** Doc §4 — "Fares are checked, not searched live" + the three fare-source cards. */
export function FareSourceCards({ content }: FareSourceCardsProps) {
  const fareSourceCards = content.list("fareSources.cards", 2).map(([title, body], index) => ({
    icon: fareSourceIcons[index % fareSourceIcons.length],
    title,
    body,
  }));
  return (
    <section className="py-10 sm:py-14">
      <Container className="flex flex-col gap-8">
        <MotionReveal>
          <SectionHeading
            align="center"
            eyebrow={content.text("fareSources.eyebrow")}
            title={content.text("fareSources.title")}
            description={content.text("fareSources.intro")}
            className="mx-auto"
          />
        </MotionReveal>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          {fareSourceCards.map(({ icon: Icon, title, body }, index) => (
            <li key={`${index}-${title}`}>
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
